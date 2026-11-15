// The AR world: ARKit tracks the room, finds the floor, and keeps every object where you put it.
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
import { getState, setState, useStore, updateEntity, pendingEntity } from './store';
import { pose, updatePose, frontPoint, yawFacing, calibrate } from './camera';

ViroMaterials.createMaterials({
  reticle: { diffuseColor: '#ffffff', lightingModel: 'Constant' },
  reticleDim: { diffuseColor: '#ffffffaa', lightingModel: 'Constant' },
  selectRing: { diffuseColor: '#4f8cff', lightingModel: 'Constant' },
});

const TRACKING_NORMAL =
  (ViroTrackingStateConstants && ViroTrackingStateConstants.TRACKING_NORMAL) ?? 3;

const PLANE_TYPES = ['ExistingPlaneUsingExtent', 'ExistingPlane', 'EstimatedHorizontalPlane'];

// Ring for the placement target (drawn in the xy plane, then laid flat on the floor)
const ring = (r) => {
  const pts = [];
  for (let i = 0; i <= 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    pts.push([Math.cos(a) * r, Math.sin(a) * r, 0]);
  }
  return pts;
};
const RING = ring(0.11);

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

// Viro gesture callbacks have used both (state, factor) and ({state, factor}) shapes; accept either.
const readPinch = (a, b) => (typeof a === 'object' && a ? [a.pinchState, a.scaleFactor] : [a, b]);
const readRotate = (a, b) => (typeof a === 'object' && a ? [a.rotateState, a.rotationFactor] : [a, b]);
const readDrag = (a) => (Array.isArray(a) ? a : a && a.dragToPos ? a.dragToPos : null);

// One 3D object in the room (or the one you are about to place)
function ModelEntity({ entity, reticle, selected, castShadow }) {
  const pending = entity.status === 'pending';
  const [fit, setFit] = useState(null); // normalises the model to a sensible real-world size
  const [userScale, setUserScale] = useState(1);
  const [spin, setSpin] = useState(0);
  const objRef = useRef(null);
  const pinchBase = useRef(1);
  const spinBase = useRef(0);
  const lastDrag = useRef(0);

  const report = (patch) => {
    if (pending) setState(patch);
  };

  const onLoadEnd = () => {
    const done = (f) => {
      setFit(f);
      report({ pendingLoad: 'ready' });
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
        // keep real-world size when believable; tiny items to ~35 cm, huge ones (buildings) to ~1 m
        let k = 1;
        if (maxDim < 0.15) k = 0.35 / maxDim;
        else if (maxDim > 3) k = 1 / maxDim;
        const cx = (b.minX + b.maxX) / 2;
        const cz = (b.minZ + b.maxZ) / 2;
        done({ k, offset: [-cx * k, -b.minY * k, -cz * k], foot: Math.max(sx, sz) * k });
      })
      .catch(() => done({ k: 1, offset: [0, 0, 0], foot: 0.6 }));
  };

  const onPinch = (a, b) => {
    if (pending) return;
    const [st, f] = readPinch(a, b);
    if (st === 1) pinchBase.current = userScale;
    else if (f) setUserScale(Math.min(8, Math.max(0.1, pinchBase.current * f)));
  };
  const onRotate = (a, b) => {
    if (pending) return;
    const [st, f] = readRotate(a, b);
    if (st === 1) spinBase.current = spin;
    else if (typeof f === 'number') setSpin(spinBase.current - f);
  };
  const onDrag = (a) => {
    const p = readDrag(a);
    if (!p || pending) return;
    const now = Date.now();
    if (now - lastDrag.current > 120) {
      lastDrag.current = now;
      updateEntity(entity.id, { pos: [p[0], entity.pos[1], p[2]] });
    }
  };

  let nodePos = [0, 0, 0];
  let opacity = 0; // invisible while measuring
  if (fit && !pending && entity.pos) {
    nodePos = entity.pos;
    opacity = 1;
  } else if (fit && pending && reticle) {
    nodePos = reticle; // see-through preview following the ring
    opacity = 0.55;
  }
  const visible = fit && opacity > 0;
  const shadow = visible && !entity.floating;
  const shadowSize = fit ? Math.max(0.2, fit.foot * 1.6) : 1;

  return (
    <>
      {visible && castShadow && shadow && (
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
      <ViroNode
        position={nodePos}
        rotation={[0, (entity.yaw || 0) + spin, 0]}
        scale={[userScale, userScale, userScale]}
        opacity={opacity}
        dragType={pending ? undefined : 'FixedToPlane'}
        dragPlane={
          !pending && entity.pos
            ? { planePoint: entity.pos, planeNormal: [0, 1, 0], maxDistance: 8 }
            : undefined
        }
        onDrag={pending ? undefined : onDrag}
        onPinch={onPinch}
        onRotate={onRotate}
        onClick={pending ? undefined : () => setState({ selectedId: entity.id })}
      >
        <Viro3DObject
          ref={objRef}
          source={{ uri: entity.url }}
          type="GLB"
          position={fit ? fit.offset : [0, 0, 0]}
          scale={fit ? [fit.k, fit.k, fit.k] : [1, 1, 1]}
          onLoadEnd={onLoadEnd}
          onError={() => report({ pendingLoad: 'error' })}
        />
        {shadow && (
          <ViroQuad
            position={[0, 0.001, 0]}
            rotation={[-90, 0, 0]}
            width={shadowSize}
            height={shadowSize}
            arShadowReceiver
          />
        )}
        {selected && fit && (
          <ViroNode position={[0, 0.004, 0]} rotation={[-90, 0, 0]}>
            <ViroPolyline
              points={ring(Math.max(0.12, fit.foot * 0.75))}
              thickness={0.008}
              materials={['selectRing']}
            />
          </ViroNode>
        )}
      </ViroNode>
    </>
  );
}

export default function ARScene(props) {
  const entities = useStore((s) => s.entities);
  const placeNonce = useStore((s) => s.placeNonce);
  const aim = useStore((s) => s.aimOnSurface);
  const selectedId = useStore((s) => s.selectedId);

  const [reticle, setReticle] = useState(null); // world position on the floor at screen centre
  const reticleRef = useRef(null);
  const lastHit = useRef(0);

  const models = entities.filter((e) => e.kind === 'model');
  const pending = models.find((e) => e.status === 'pending');
  const placedModels = models.filter((e) => e.status === 'placed');
  const shadowId = selectedId || (placedModels.length ? placedModels[placedModels.length - 1].id : null);

  // Place pressed (or Siri asked): anchor the waiting object
  useEffect(() => {
    if (!placeNonce) return;
    const e = pendingEntity();
    if (!e || e.kind !== 'model' || getState().pendingLoad !== 'ready') return;
    let pos = reticleRef.current;
    let floating = false;
    if (!pos || !getState().aimOnSurface) {
      // not pointing at the floor: put it about a metre in front of you
      const fp = frontPoint(1.0);
      if (!fp) return;
      pos = fp.pos;
      floating = fp.floating;
    }
    updateEntity(e.id, { status: 'placed', pos, yaw: yawFacing(pos), floating });
    setState({ pendingLoad: 'idle', selectedId: null });
  }, [placeNonce]);

  // Every frame ARKit reports where the phone is and what is at the centre of the screen
  const onHitTest = (e) => {
    if (!e) return;
    if (e.cameraOrientation) {
      updatePose(e.cameraOrientation);
      calibrate(props.arSceneNavigator || props.sceneNavigator);
    }
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
    if (pose.floorY == null || pos[1] < pose.floorY) pose.floorY = pos[1];
    setState({ surfaceFound: true, aimOnSurface: true });
    const now = Date.now();
    if (now - lastHit.current > 50 && (!reticle || dist(pos, reticle) > 0.004)) {
      lastHit.current = now;
      setReticle(pos);
    }
  };

  const onTracking = (st) => setState({ trackingOk: st === TRACKING_NORMAL });

  return (
    <ViroARScene
      anchorDetectionTypes={['PlanesHorizontal']}
      onCameraARHitTest={onHitTest}
      onTrackingUpdated={onTracking}
    >
      <ViroAmbientLight color="#ffffff" intensity={350} />
      <ViroDirectionalLight color="#ffffff" direction={[-0.3, -1, -0.4]} intensity={700} />

      {/* Floor ring: where the next object will go */}
      {pending && reticle && (
        <ViroNode position={[reticle[0], reticle[1] + 0.002, reticle[2]]} rotation={[-90, 0, 0]}>
          <ViroPolyline points={RING} thickness={0.006} materials={[aim ? 'reticle' : 'reticleDim']} />
        </ViroNode>
      )}

      {models.map((e) => (
        <ModelEntity
          key={e.id}
          entity={e}
          reticle={reticle}
          selected={e.id === selectedId}
          castShadow={e.id === shadowId}
        />
      ))}
    </ViroARScene>
  );
}
