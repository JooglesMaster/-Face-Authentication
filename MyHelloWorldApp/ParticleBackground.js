import React, { useRef, useEffect } from 'react';
import { View, Animated, Easing, Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

const ParticleBackground = ({ count = 50, colors = ['#6C63FF'] }) => {
  const particles = useRef(new Array(count).fill(0).map(() => new Animated.Value(0)));

  useEffect(() => {
    Animated.parallel(
      particles.current.map(particle => {
        return Animated.loop(
          Animated.timing(particle, {
            toValue: 1,
            duration: Math.random() * 5000 + 5000,
            easing: Easing.linear,
            useNativeDriver: true,
          })
        );
      })
    ).start();
  }, []);

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      {particles.current.map((particle, index) => {
        const size = Math.random() * 3 + 1;
        const translateX = particle.interpolate({
          inputRange: [0, 1],
          outputRange: [Math.random() * width, Math.random() * width],
        });
        const translateY = particle.interpolate({
          inputRange: [0, 1],
          outputRange: [Math.random() * height, Math.random() * height],
        });
        const opacity = particle.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [0, 1, 0],
        });

        return (
          <Animated.View
            key={index}
            style={{
              position: 'absolute',
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: colors[Math.floor(Math.random() * colors.length)],
              opacity,
              transform: [{ translateX }, { translateY }],
            }}
          />
        );
      })}
    </View>
  );
};

export default ParticleBackground;