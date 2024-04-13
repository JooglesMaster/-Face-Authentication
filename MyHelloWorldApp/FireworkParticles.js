import React, { useRef, useEffect, useState } from 'react';
import { View, Animated, Easing, Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

const FireworkParticles = ({ count = 20, colors = ['#ff4081', '#7c4dff', '#ffea00', '#00e676'], duration = 15000 }) => {
  const particles = useRef(new Array(count).fill(0).map(() => new Animated.Value(0)));
  const [isAnimating, setIsAnimating] = useState(true);

  useEffect(() => {
    const animateParticles = () => {
      Animated.parallel(
        particles.current.map(particle => {
          const destinationX = Math.random() * width;
          const destinationY = Math.random() * (height / 2);

          return Animated.timing(particle, {
            toValue: 1,
            duration: 1000,
            easing: Easing.ease,
            useNativeDriver: true,
          });
        })
      ).start(() => {
        if (isAnimating) {
          particles.current.forEach(particle => particle.setValue(0));
          animateParticles();
        }
      });
    };

    animateParticles();

    const timer = setTimeout(() => {
      setIsAnimating(false);
    }, duration);

    return () => {
      clearTimeout(timer);
    };
  }, [duration, isAnimating]);

  return (
    <View style={{ position: 'absolute', top: -200, left: 0, right: 0, bottom: 0 }}>
      {particles.current.map((particle, index) => {
        const angle = Math.random() * 2 * Math.PI;
        const radius = Math.random() * 50 + 50;
        const destinationX = width / 2 + Math.cos(angle) * radius;
        const destinationY = height / 2 + Math.sin(angle) * radius;

        const translateX = particle.interpolate({
          inputRange: [0, 1],
          outputRange: [width / 2, destinationX],
        });
        const translateY = particle.interpolate({
          inputRange: [0, 1],
          outputRange: [height /2, destinationY],
        });
        const opacity = particle.interpolate({
          inputRange: [0, 0.8, 1],
          outputRange: [1, 1, 0],
        });
        const scale = particle.interpolate({
          inputRange: [0, 0.8, 1],
          outputRange: [0, 1, 0],
        });

        return (
          <Animated.View
            key={index}
            style={{
              position: 'absolute',
              width: 10,
              height: 10,
              borderRadius: 5,
              backgroundColor: colors[Math.floor(Math.random() * colors.length)],
              opacity,
              transform: [{ translateX }, { translateY }, { scale }],
            }}
          />
        );
      })}
    </View>
  );
};

export default FireworkParticles