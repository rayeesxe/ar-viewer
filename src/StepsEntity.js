// Step-by-step card pinned beside a how-to video. Say "next step" or tap a step.
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, useWindowDimensions } from 'react-native';
import { onPose, project, pose } from './camera';
import { removeEntity, updateEntity } from './store';

const CW = 260;
const CH = 300;
const SIZE_M = 0.5; // width in the room

export default function StepsEntity({ entity }) {
  const steps = entity.steps || [];
  const cur = Math.min(entity.stepIdx || 0, Math.max(0, steps.length - 1));
  const { width: W, height: H } = useWindowDimensions();
  const landscape = W > H;

  const tx = useRef(new Animated.Value(-9999)).current;
  const ty = useRef(new Animated.Value(-9999)).current;
  const sc = useRef(new Animated.Value(1)).current;
  const sx = useRef(new Animated.Value(1)).current;
  const op = useRef(new Animated.Value(0)).current;
  const [hidden, setHiddenState] = useState(true);
  const hiddenRef = useRef(true);
  const setHidden = (h) => {
    if (hiddenRef.current !== h) {
      hiddenRef.current = h;
      setHiddenState(h);
    }
  };

  useEffect(() => {
    if (!entity.pos || landscape) {
      op.setValue(0);
      setHidden(true);
      return undefined;
    }
    const update = () => {
      const p = project(entity.pos);
      if (!p || p.x < -W || p.x > 2 * W || p.y < -H || p.y > 2 * H) {
        op.setValue(0);
        setHidden(true);
        return;
      }
      tx.setValue(p.x);
      ty.setValue(p.y);
      sc.setValue(Math.max(0.1, Math.min(3, (pose.focal * SIZE_M) / p.z / CW)));
      let narrow = 1;
      if (pose.position) {
        const yaw = ((entity.yaw || 0) * Math.PI) / 180;
        const view = Math.atan2(pose.position[0] - entity.pos[0], pose.position[2] - entity.pos[2]);
        const a = Math.abs(Math.atan2(Math.sin(view - yaw), Math.cos(view - yaw)));
        narrow = Math.max(0.12, Math.cos(Math.min(a, Math.PI / 2)));
      }
      sx.setValue(narrow);
      op.setValue(1);
      setHidden(false);
    };
    update();
    return onPose(update);
  }, [entity.pos, entity.yaw, landscape, W, H]); // eslint-disable-line react-hooks/exhaustive-deps

  const go = (i) => updateEntity(entity.id, { stepIdx: Math.max(0, Math.min(steps.length - 1, i)) });

  return (
    <Animated.View
      pointerEvents={hidden ? 'none' : 'box-none'}
      style={[
        styles.card,
        {
          opacity: op,
          transform: [
            { translateX: Animated.subtract(tx, CW / 2) },
            { translateY: Animated.subtract(ty, CH / 2) },
            { scale: sc },
            { scaleX: sx },
          ],
        },
      ]}
    >
      <View style={styles.head}>
        <Text style={styles.title} numberOfLines={2}>
          {entity.title || 'Steps'}
        </Text>
        <TouchableOpacity onPress={() => removeEntity(entity.id)} style={styles.x}>
          <Text style={styles.xText}>✕</Text>
        </TouchableOpacity>
      </View>
      {steps.map((s, i) => (
        <TouchableOpacity key={i} onPress={() => go(i)} style={styles.row}>
          <View style={[styles.num, i < cur && styles.numDone, i === cur && styles.numNow]}>
            <Text style={[styles.numText, i === cur && { color: '#000' }]}>{i < cur ? '✓' : i + 1}</Text>
          </View>
          <Text style={[styles.step, i === cur && styles.stepNow, i < cur && styles.stepDone]}>{s}</Text>
        </TouchableOpacity>
      ))}
      <Text style={styles.hint}>Say "next step"</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: CW,
    minHeight: CH,
    padding: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(14,14,16,0.86)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  head: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  title: { flex: 1, color: '#fff', fontSize: 15, fontWeight: '600' },
  x: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.12)' },
  xText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5, gap: 10 },
  num: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  numDone: { backgroundColor: 'rgba(52,199,89,0.85)', borderColor: 'transparent' },
  numNow: { backgroundColor: '#ffffff', borderColor: 'transparent' },
  numText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  step: { flex: 1, color: 'rgba(255,255,255,0.75)', fontSize: 13 },
  stepNow: { color: '#fff', fontWeight: '600', fontSize: 14 },
  stepDone: { color: 'rgba(255,255,255,0.4)', textDecorationLine: 'line-through' },
  hint: { color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 8 },
});
