// The AR world: ARKit tracks the room, finds the floor, and anchors the object where you place it.
import React, { useEffect, useRef, useState } from 'react';
import {
  ViroARScene,
  ViroNode,
  Viro3DObject,
  ViroPolyline,
  ViroQuad,
  ViroAmbientLight,
  ViroDirectionalLight,
  ViroSpotLight,
  ViroMaterials,
  ViroTrackingStateConstants,
} from '@reactvision/react-viro';
import { getState, setState, useStore } from './store';

ViroMaterials.createMaterials({
  reticle: { diffuseColor: '#ffffff', lightingModel: 'Constant' },
  reticleDim: { diffuseColor: '#ffffffaa', lightingModel: 'Constant' },
});

const TRACKING_NORMAL =
  (ViroTrackingStateConstants && ViroTrackingStateConstants.TRACKING_NORMAL) ?? 3;

const PLANE_TYPES = ['ExistingPlaneUsingExtent', 'ExistingPlane', 'EstimatedHorizontalPlane'];

// Ring for the placement target (drawn in the xy plane, then laid flat on the floor)
const RING = (() => {
  const pts = [];
  const r = 0.11;
  for (let i = 0; i <= 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    pts.push([Math.cos(a) * r, Math.sin(a) * r, 0]);
  }
  return pts;
})();

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

// Viro gesture callbacks have used both (state, factor) and ({state, factor}) shapes; accept either.
const readPinch = (a, b) =>
  typeof a === 'object' && a ? [a.pinchState, a.scaleFactor] : [a, b];
const readRotate = (a, b) =>
  typeof a === 'object' && a ? [a.rotateState, a.rotationFactor] : [a, b];
const readDrag = (a) => (Array.isArray(a) ? a : a && a.dragToPos ? a.dragToPos : null);

export default function ARScene() {
  const modelUrl = useStore((s) => s.modelUrl);
  const placeNonce = useStore((s) => s.placeNonce);
  const placed = useStore((s) => s.placed);
  const aim = useStore((s) => s.aimOnSurface);

  const [reticle, setReticle] = useState(null); // world position on the floor at screen centre
  const [fit, setFit] = useState(null); // { k, offset, foot } normalises the model to a sensible size
  const [anchorPos, setAnchorPos] = useState(null); // where the object is anchored
  const [yaw, setYaw] = useState(0);
  const [userScale, setUserScale] = useState(1);
  const [spin, setSpin] = useState(0);

  const reticleRef = useRef(null);
  const camRef = useRef(null);
  const lastHit = useRef(0);
  const objRef = useRef(null);
  const pinchBase = useRef(1);
  const spinBase = useRef(0);
  const dragPos = useRef(null);
  const lastDragSet = useRef(0);

  // New object chosen: reset everything for it
  useEffect(() => {
    setFit(null);
    setAnchorPos(null);
    setUserScale(1);
    setSpin(0);
    setState({ placed: false, loadState: modelUrl ? 'loading' : 'idle' });
  }, [modelUrl]);

  // "Move" pressed in the UI: release the anchor so the object follows the ring again
  useEffect(() => {
    if (!placed) setAnchorPos(null);
  }, [placed]);

  // "Place" pressed in the UI: anchor the object on the floor where the ring is
  useEffect(() => {
    if (!placeNonce) return;
    const p = reticleRef.current;
    if (!p || !fit) return;
    const cam = camRef.current && camRef.current.position;
    if (cam) {
      // turn the object to face you
      setYaw((Math.atan2(cam[0] - p[0], cam[2] - p[2]) * 180) / Math.PI);
    }
    setAnchorPos(p);
    dragPos.current = p;
    setState({ placed: true });
  }, [placeNonce]); // eslint-disable-line react-hooks/exhaustive-deps

  // Every frame ARKit reports what is at the centre of the screen
  const onHitTest = (e) => {
    if (!e) return;
    if (e.cameraOrientation) camRef.current = e.cameraOrientation;
    const results = e.hitTestResults || [];
    let hit = null;
    for (const t of PLANE_TYPES) {
      hit = results.find((r) => r.type === t);
      if (hit) break;
    }
    if (!hit) {
      if (getState().aimOnSurface) setState({ aimOnSurface: false });
      return;
    }
    const pos = hit.transform.position;
    reticleRef.current = pos;
    setState({ surfaceFound: true, aimOnSurface: true });
    const now = Date.now();
    if (now - lastHit.current > 50 && (!reticle || dist(pos, reticle) > 0.004)) {
      lastHit.current = now;
      setReticle(pos);
    }
  };

  const onTracking = (st) => setState({ trackingOk: st === TRACKING_NORMAL });

  // Measure the model once it loads so every object sits on the floor at a sensible size
  const onLoadEnd = () => {
    const done = (f) => {
      setFit(f);
      setState({ loadState: 'ready' });
    };
    const obj = objRef.current;
    if (!obj || !obj.getBoundingBoxAsync) return done({ k: 1, offset: [0, 0, 0], foot: 0.6 });
    obj
      .getBoundingBoxAsync()
      .then((res) => {
        const b = (res && res.boundingBox) || res;
        const sx = b.maxX - b.minX;
        const sy = b.maxY - b.minY;
        const sz = b.maxZ - b.minZ;
        const maxDim = Math.max(sx, sy, sz);
        if (!isFinite(maxDim) || maxDim <= 0) throw new Error('bad bounds');
        // keep real-world size when it is believable; small items to ~35 cm, huge ones to ~1 m
        let k = 1;
        if (maxDim < 0.15) k = 0.35 / maxDim;
        else if (maxDim > 4) k = 1 / maxDim;
        const cx = (b.minX + b.maxX) / 2;
        const cz = (b.minZ + b.maxZ) / 2;
        done({
          k,
          offset: [-cx * k, -b.minY * k, -cz * k],
          foot: Math.max(sx, sz) * k,
        });
      })
      .catch(() => done({ k: 1, offset: [0, 0, 0], foot: 0.6 }));
  };

  const onPinch = (a, b) => {
    if (!placed) return;
    const [st, f] = readPinch(a, b);
    if (st === 1) pinchBase.current = userScale;
    else if (f) setUserScale(Math.min(6, Math.max(0.15, pinchBase.current * f)));
  };

  const onRotate = (a, b) => {
    if (!placed) return;
    const [st, f] = readRotate(a, b);
    if (st === 1) spinBase.current = spin;
    else if (typeof f === 'number') setSpin(spinBase.current - f);
  };

  const onDrag = (a) => {
    const p = readDrag(a);
    if (!p) return;
    dragPos.current = p;
    const now = Date.now();
    if (now - lastDragSet.current > 120) {
      lastDragSet.current = now;
      setAnchorPos([p[0], anchorPos ? anchorPos[1] : p[1], p[2]]);
    }
  };

  // Where the object is right now
  let nodePos = [0, 0, 0];
  let opacity = 0; // invisible while measuring
  if (fit && placed && anchorPos) {
    nodePos = anchorPos;
    opacity = 1;
  } else if (fit && reticle) {
    nodePos = reticle; // "ghost" preview following the ring
    opacity = 0.55;
  }
  const showShadow = fit && opacity > 0;
  const shadowSize = fit ? Math.max(0.2, fit.foot * 1.6) : 1;

  return (
    <ViroARScene
      anchorDetectionTypes={['PlanesHorizontal']}
      onCameraARHitTest={onHitTest}
      onTrackingUpdated={onTracking}
    >
      <ViroAmbientLight color="#ffffff" intensity={350} />
      <ViroDirectionalLight color="#ffffff" direction={[-0.3, -1, -0.4]} intensity={700} />

      {/* Floor ring: where the object will go */}
      {modelUrl && !placed && reticle && (
        <ViroNode position={[reticle[0], reticle[1] + 0.002, reticle[2]]} rotation={[-90, 0, 0]}>
          <ViroPolyline
            points={RING}
            thickness={0.006}
            materials={[aim ? 'reticle' : 'reticleDim']}
          />
        </ViroNode>
      )}

      {/* Light that casts a real shadow under the object */}
      {showShadow && (
        <ViroSpotLight
          position={[nodePos[0], nodePos[1] + 2.5, nodePos[2]]}
          direction={[0, -1, 0]}
          innerAngle={10}
          outerAngle={40}
          attenuationStartDistance={3}
          attenuationEndDistance={6}
          color="#ffffff"
          intensity={250}
          castsShadow
          shadowMapSize={2048}
          shadowNearZ={0.5}
          shadowFarZ={4}
          shadowOpacity={0.55}
        />
      )}

      {modelUrl && (
        <ViroNode
          position={nodePos}
          rotation={[0, yaw + spin, 0]}
          scale={[userScale, userScale, userScale]}
          opacity={opacity}
          dragType={placed ? 'FixedToPlane' : undefined}
          dragPlane={
            placed && anchorPos
              ? { planePoint: anchorPos, planeNormal: [0, 1, 0], maxDistance: 6 }
              : undefined
          }
          onDrag={placed ? onDrag : undefined}
          onPinch={onPinch}
          onRotate={onRotate}
        >
          <Viro3DObject
            key={modelUrl}
            ref={objRef}
            source={{ uri: modelUrl }}
            type="GLB"
            position={fit ? fit.offset : [0, 0, 0]}
            scale={fit ? [fit.k, fit.k, fit.k] : [1, 1, 1]}
            onLoadEnd={onLoadEnd}
            onError={() => setState({ loadState: 'error' })}
          />
          {showShadow && (
            <ViroQuad
              position={[0, 0.001, 0]}
              rotation={[-90, 0, 0]}
              width={shadowSize}
              height={shadowSize}
              arShadowReceiver
            />
          )}
        </ViroNode>
      )}
    </ViroARScene>
  );
}
