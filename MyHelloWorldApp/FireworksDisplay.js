import React, { useState, useEffect } from 'react';
import { View } from 'react-native';
import FireworkParticles from './FireworkParticles';

const FireworksDisplay = ({ numberOfFireworks = 5, launchInterval = 2000 }) => {
  const [fireworks, setFireworks] = useState([]);

  useEffect(() => {
    const interval = setInterval(() => {
      const newFirework = {
        key: Date.now(), // Unique key based on timestamp
        colors: ['#ff4081', '#7c4dff', '#ffea00', '#00e676'], // Customize as needed
        count: 20, // Number of particles
        duration: 5000 // Duration of the animation
      };
      
      // Adding new firework and cleaning up finished ones
      setFireworks(fws => [...fws, newFirework].slice(-numberOfFireworks));
    }, launchInterval);

    return () => clearInterval(interval);
  }, [launchInterval, numberOfFireworks]);

  return (
    <View style={{ flex: 1 }}>
      {fireworks.map(firework => (
        <FireworkParticles
          key={firework.key}
          count={firework.count}
          colors={firework.colors}
          duration={firework.duration}
        />
      ))}
    </View>
  );
};

export default FireworksDisplay;
