import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber/native';
import { Gltf } from '@react-three/drei/native';

export const ModelComponent = () => {
  const modelRef = useRef();

  useFrame(({ clock }) => {
    if (modelRef.current) {
      modelRef.current.rotation.y = clock.getElapsedTime() * 0.5;
    }
  });

  return (
    <Gltf
      ref={modelRef}
      src={require('../assets/model.glb')}
      scale={1}
      position={[0, 0, 0]}
    />
  );
};