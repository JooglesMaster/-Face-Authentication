import React, { useState, useEffect} from 'react';
import { Suspense } from "react";
import { StyleSheet, View, Image, Alert,ActivityIndicator, Text,ScrollView, TouchableOpacity, Dimensions,Button, TextInput } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Canvas } from "@react-three/fiber/native";
import { ModelComponent } from './components/ModelComponent';
import AWS from 'aws-sdk';
import ParticleBackground from './ParticleBackground';
import FireworkParticles from './FireworkParticles';
import defaultImage from './assets/default_image.png';
import closerImage from './assets/closer_default.png';


const windowHeight = Dimensions.get('window').height;

export default function App() {

  const [imageUri, setImageUri] = useState(null);
  
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [enrolledAsset, setEnrolledAsset] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [responseText, setresponseText] = useState('hello');
  const [uploadProgress, setUploadProgress] = useState(0); // New state for upload progress
  const [initialHeadSize, setInitialHeadSize] = useState(null);
  const [stage, setStage] = useState(0)
  const [pin, setPin] = useState('');
  const [name, setName] = useState('');

  // Initialize S3 with your configuration
  const s3 = new AWS.S3({
    region: 'eu-west-2',
    credentials: new AWS.Credentials('AKIAV6FHEIYOV7JSII6Q','Has2vd5PUuI6GT+6d9I8bKCD/fhb7plN9kh/ETC/')
  })

  const rekognition = new AWS.Rekognition({
    region: 'eu-west-2',
    credentials: new AWS.Credentials('AKIAV6FHEIYOV7JSII6Q', 'Has2vd5PUuI6GT+6d9I8bKCD/fhb7plN9kh/ETC/')
  });
  

// Function to handle image selection
useEffect(() => {
  if (selectedAsset) {
    uploadImageToS3();
  }
}, [selectedAsset]);

useEffect(() => {
  if (enrolledAsset) {
    // Actions to take after enrollment is successful
    console.log('Enrollment photo is set:', enrolledAsset);
    // e.g., Navigate to a new screen or enable new app features
  }
}, [enrolledAsset]);


const selectImage = async () => {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: false,
    aspect: [4, 3],
    quality: 1,
  });

  if (!result.cancelled) {
    setImageUri(result.assets[0].uri);
    setSelectedAsset(result.assets[0]);
  }
};

// Function to handle image capture
const captureImage = async () => {
  const permissionResult = await ImagePicker.requestCameraPermissionsAsync();

  if (permissionResult.granted === false) {
    Alert.alert('Permission Required', 'You need to grant camera access to take a picture.');
    return;
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: false,
    aspect: [4, 3],
    quality: 1,
  });

  if (!result.cancelled) {
    setImageUri(result.uri);
    setSelectedAsset(result);

  }
};

// Function to upload the image to S3
const uploadImageToS3 = async () => {
  if (!selectedAsset) {
    Alert.alert('No Image Selected', 'Please select an image first.');
    return;
  }

  setUploading(true);
  setUploadProgress(0); // Reset upload progress

  const response = await fetch(selectedAsset.uri);
  const blob = await response.blob();

  const file = {
    uri: selectedAsset.uri,
    name: selectedAsset.uri.split('/').pop(),
    type: selectedAsset.type || 'image/jpeg'
  };

  const s3Params = {
    Bucket: 'joeappimage',
    Key: file.name,
    Body: blob,
    ContentType: file.type,
  };

  const uploader = s3.upload(s3Params);

  // Listen for progress updates and update the state
  uploader.on('httpUploadProgress', function(evt) {
    setUploadProgress(Math.round((evt.loaded / evt.total) * 100));
  });

  uploader.send(function(err, data) {
    setUploading(false);

    if (err) {
      console.error('Error uploading file: ', err);
      Alert.alert('Upload Failed', err.message);
      return;
    }
    Alert.alert('Upload Successful', 'File uploaded successfully');
    setUploadProgress(0); // Reset upload progress after successful upload
  });
};


const uploadEnrollmentPhotoToS3 = async (photoAsset) => {
  // Ensure there's a photo to upload
  if (!photoAsset) {
    Alert.alert('No Image Selected', 'Please select an image for enrollment.');
    return;
  }

  setUploading(true);
  setUploadProgress(0); // Initialize upload progress

  const response = await fetch(photoAsset.uri);
  const blob = await response.blob();

  const fileName = `enrollment_${new Date().toISOString()}.jpg`; // A dynamic file name for the enrollment photo
  const s3Params = {
    Bucket: 'enrollphotos',
    Key: fileName,
    Body: blob,
    ContentType: 'image/jpeg',
  };

  const uploader = s3.upload(s3Params);

  // Listen for progress updates and update the state
  uploader.on('httpUploadProgress', function(evt) {
    setUploadProgress(Math.round((evt.loaded / evt.total) * 100));
  });

  uploader.send(function(err, data) {
    setUploading(false);

    if (err) {
      console.error('Error uploading file: ', err);
      Alert.alert('Upload Failed', err.message);
    } else {
      // On successful upload, update the enrolledAsset state with relevant details
      setEnrolledAsset({
        uri: photoAsset.uri,
        s3Key: fileName, // Assuming fileName is the key used in S3
      });

      Alert.alert('Upload Successful', 'Enrollment photo uploaded successfully.');
      nextStage()
      setImageUri(null)
    }
  });
};



const analyzeImage = async () => {
  const imageKey = selectedAsset.uri.split('/').pop(); // or however you're defining your imageKey

  // Assuming you have set up your API Gateway and Lambda function
  const apiUrl = `https://6o2o71sho4.execute-api.eu-west-2.amazonaws.com/prod/analysis/${imageKey}`;
  try {
    let response = await fetch(apiUrl);
    let jsonResponse = await response.json();

    if (response.ok) {
      // Assuming the response JSON has a property "message" that you want to display
      setresponseText(JSON.stringify(jsonResponse)); // Use JSON.stringify to convert JSON object to string if needed
    } else {
      Alert.alert('Analysis Failed', jsonResponse.message);
    }
  } catch (error) {
    console.error('Error during analysis:', error);
    Alert.alert('Analysis Error', error.message);
  }
};

const compareFaces = async () => {
  if (!selectedAsset || !enrolledAsset) {
    Alert.alert('Missing Images', 'Please ensure both enrollment and comparison photos are selected.');
    return;
  }

  // Use enrolledAsset.s3Key for the SourceImage
  const params = {
    SourceImage: {
      S3Object: {
        Bucket: 'enrollphotos',
        Name: enrolledAsset.s3Key
      }
    },
    TargetImage: {
      S3Object: {
        Bucket: 'joeappimage',
        Name: selectedAsset.uri.split('/').pop()
      }
    },
    SimilarityThreshold: 80 // Adjust as needed
  };

  rekognition.compareFaces(params, function(err, response) {
    if (err) {
      console.error(err, err.stack);
      Alert.alert('Comparison Failed', err.message);
    } else {
      console.log(response);
      if (response.FaceMatches && response.FaceMatches.length > 0) {
        const match = response.FaceMatches[0];
        if (match.Similarity > 99.5) {
          Alert.alert('Match Found', `Similarity: ${match.Similarity}%`);
          nextStage()
          
          // Store the initial head size
          const initialSize = match.Face.BoundingBox;
          setInitialHeadSize(initialSize);
          setImageUri(null)
        } else {
          Alert.alert('Low Similarity', 'Please take another photo.', [
            { text: 'OK', onPress: () => setStage(0) } // Go back to stage 0 for taking another photo
          ]);
        }
      } else {
        Alert.alert('No Match Found', 'The faces do not match.', [
          { text: 'OK', onPress: () => setStage(4) } // Go back to stage 0 for taking another photo
        ]);
      }
    }
  });
};

const detectEyes = async () => {
  if (!selectedAsset) {
    Alert.alert('No Image Selected', 'Please select an image first.');
    return;
  }

  const imageKey = selectedAsset.uri.split('/').pop();

  const params = {
    Image: {
      S3Object: {
        Bucket: 'joeappimage',
        Name: imageKey,
      },
    },
    Attributes: ['ALL'],
  };

  try {
    const data = await rekognition.detectFaces(params).promise();
    
    if (data && data.FaceDetails && data.FaceDetails.length > 0) {
      const face = data.FaceDetails[0];
      const leftEyeOpen = face.EyesOpen.Value;
      const rightEyeOpen = face.EyesOpen.Value;

      console.log('Left Eye Open:', leftEyeOpen);
      console.log('Right Eye Open:', rightEyeOpen);

      // Compare the head size with the initial head size
      const currentSize = face.BoundingBox;
      if (initialHeadSize) {
        const sizeRatio = (currentSize.Width * currentSize.Height) / (initialHeadSize.Width * initialHeadSize.Height);
        if (sizeRatio < 1.2) {
          Alert.alert('Distance Too Far', 'Please take a closer photo for eye detection.');
          return;
        }
      }

      if (!leftEyeOpen || !rightEyeOpen) {
        Alert.alert('Eye Closed', 'Great! Proceeding to the next stage.');
        setStage(3);
      } else {
        Alert.alert('Both Eyes Open', 'Please take a photo with at least one eye closed.', [
          { text: 'OK', onPress: () => setSelectedAsset(null) }
        ]);
      }
    } else {
      Alert.alert('No Faces Detected', 'Could not detect any faces in the image.', [
        { text: 'OK', onPress: () => setSelectedAsset(null) } // Clear the selected asset to allow capturing a new photo
      ]);
    }
  } catch (error) {
    console.error('Error detecting eyes:', error);
    Alert.alert('Detection Error', error.message);
  }

  console.log('Rekognition Params:', params);
};

const detectLiveness = async (livenessCheck) => {
  if (!selectedAsset || !enrolledAsset) {
    Alert.alert('Missing Images', 'Please ensure both enrollment and liveness photos are selected.');
    return;
  }

  const imageKey = selectedAsset.uri.split('/').pop();
  const params = {
    Image: {
      S3Object: {
        Bucket: 'joeappimage',
        Name: imageKey,
      },
    },
    Attributes: ['ALL'],
  };

  try {
    const data = await rekognition.detectFaces(params).promise();
    console.log("Rekognition Response:", data);

    if (data && data.FaceDetails && data.FaceDetails.length > 0) {
      const face = data.FaceDetails[0];

      // Get the face size from the liveness detection photo
      const livenessFaceSize = face.BoundingBox.Width * face.BoundingBox.Height;

      // Get the face size from the enrollment photo
      const enrollmentParams = {
        Image: {
          S3Object: {
            Bucket: 'enrollphotos',
            Name: enrolledAsset.s3Key,
          },
        },
        Attributes: ['ALL'],
      };
      const enrollmentData = await rekognition.detectFaces(enrollmentParams).promise();
      const enrollmentFace = enrollmentData.FaceDetails[0];
      const enrollmentFaceSize = enrollmentFace.BoundingBox.Width * enrollmentFace.BoundingBox.Height;

      // Compare the face sizes
      if (livenessFaceSize <= enrollmentFaceSize) {
        Alert.alert('Distance Too Far', 'Please take a closer photo for liveness detection.');
        return;
      }

      // Randomly choose between checking for closed eyes or smile
      const checkEyesClosed = Math.random() < 0.5;

      if (livenessCheck === 'eyes') {
        // Check if eyes are closed
        const eyesClosed = face.EyesOpen && !face.EyesOpen.Value;
        if (eyesClosed) {
          Alert.alert('Liveness Detected', 'Eyes closed detected. Liveness confirmed.');
          nextStage()
        } else {
          Alert.alert('Liveness Not Detected', 'Please close your eyes for liveness detection.');
        }
      } else if (livenessCheck === 'smile') {
        // Check for smile
        const isSmiling = face.Smile && face.Smile.Value;
        if (isSmiling) {
          Alert.alert('Liveness Detected', 'Smile detected. Liveness confirmed.');
          nextStage()
        } else {
          Alert.alert('Liveness Not Detected', 'Please smile for liveness detection.');
        }
      }
    } else {
      Alert.alert('No Faces Detected', 'Could not detect any faces in the image.', [
        { text: 'OK', onPress: () => setSelectedAsset(null) }
      ]);
    }
  } catch (error) {
    console.error('Error detecting liveness:', error);
    Alert.alert('Detection Error', error.message);
  }
};

const nextStage = () => {
  setStage(stage + 1);
};


const resetStages = () => {
  setStage(0);
  setImageUri(null);
  setSelectedAsset(null);
  setUploading(false);
  setresponseText('hello');
  setInitialHeadSize(null); // Reset the initial head size
  setUploadProgress(0);
};

const CustomButton = ({ onPress, title }) => (
  <View style={styles.buttonWrapper}>
    <TouchableOpacity onPress={onPress} style={styles.button}>
      <Text style={styles.buttonText}>{title}</Text>
    </TouchableOpacity>
  </View>
);

const WelcomeScreen = ({ onStart }) => {
  return (
    <View style={styles.welcomeContainer}>
      <ParticleBackground count={200} colors={['#6C63FF', '#8B5CF6']} />
      {/* <FireworkParticles count={30} duration={1} /> */}
      <Canvas style={styles.modelView}>
        <ambientLight />
        <pointLight position={[10, 10, 10]} color="blue" intensity={2}/>
        <pointLight position={[-10, -10, -10]} color="blue" intensity={2} />
        <Suspense>
          <ModelComponent />
        </Suspense>
      </Canvas>
      <Text style={styles.title}>Welcome to TwinGuard !</Text>
      <Text style={styles.text}>A Facial recognition app</Text>
      <CustomButton title="Get Started" onPress={nextStage} />
    </View>
  );
};

const EnrollmentScreen = () => {
  return (
    <>
      {/* <ParticleBackground count={200} colors={['#6C63FF', '#8B5CF6']} /> */}
      {imageUri ? (
        <View style={styles.imageContainer}>
          <Image source={{ uri: imageUri }} style={styles.imagePreview} />
        </View>
      ) : (
        <View style={styles.imagePlaceholder}>
          {uploading ? (
            <>
              <ActivityIndicator size="large" color="#0000ff" />
              <Text>{uploadProgress}%</Text>
            </>
          ) : (
            <Image source={defaultImage} style={styles.defaultImage} />
          )}
        </View>
      )}
      <Text style={styles.title}>Enrollment Photo</Text>
      <Text style={styles.text}>To enroll please take a photo, this will be used as your identity</Text>
      <View style={styles.buttonContainer}>
        <CustomButton title="Capture Image" onPress={captureImage} />
        <CustomButton
          title="Enroll"
          onPress={() => {
            if (selectedAsset) {
              uploadEnrollmentPhotoToS3(selectedAsset);
            } else {
              Alert.alert('Missing Information', 'Please capture an image for enrollment.');
            }
          }}
        />
        <CustomButton title="Reset" onPress={resetStages} />
      </View>
    </>
  );
};

const SecuritySetupScreen = () => {
  // Handle the submission of the PIN and name
  const handleSubmit = () => {
    nextStage()
  };

  return (
    <View style={styles.securitySetupContainer}>
      <Text style={styles.title}>Security Setup</Text>
      <Text style={styles.text}>
        Please enter a PIN and your name for additional security. These will be used for verification purposes.
      </Text>

      <View style={styles.inputWrapper}>
        <TextInput
          style={styles.input}
          onChangeText={setPin}
          value={pin}
          placeholder="Enter a PIN Number"
          keyboardType="numeric"
          maxLength={4} // Assuming a 4-digit PIN
        />
      </View>

      <View style={styles.inputWrapper}>
        <TextInput
          style={styles.input}
          onChangeText={setName}
          value={name}
          placeholder="   Enter your name   "
          keyboardType="default"
        />
      </View>
      <View style={{ marginTop: 35 }}>
        <CustomButton title="Confirm" onPress={handleSubmit} />
      </View>
    </View>
  );
};
const HomeScreen = ({ onStart }) => {
  return (
    <View style={styles.welcomeContainer}>
      <ParticleBackground count={200} colors={['#6C63FF', '#8B5CF6']} />
      {/* <FireworkParticles count={30} duration={1} /> */}
      <Canvas style={styles.modelView}>
        <ambientLight />
        <pointLight position={[10, 10, 10]} color="blue" intensity={2}/>
        <pointLight position={[-10, -10, -10]} color="blue" intensity={2} />
        <Suspense>
          <ModelComponent />
        </Suspense>
      </Canvas>
      <Text style={styles.title}>Welcome back {name} !</Text>
      <Text style={styles.text}>Would you like the authenticate or enrol again?</Text>
      <CustomButton title="Authenticate" onPress={nextStage} />
      <CustomButton title="    Reset    " onPress={nextStage} />
    </View>
  );
};
const CaptureImageScreen = () => {
  return (
    <>
      {imageUri && (
        <View style={styles.imageContainer}>
          <Image source={{ uri: imageUri }} style={styles.imagePreview} />
        </View>
      )}
      {!imageUri && (
        <View style={styles.imagePlaceholder}>
          {uploading && (
            <>
              <ActivityIndicator size="large" color="#0000ff" />
              <Text>{uploadProgress}%</Text>
            </>
          )}
          <Text>No Image Selected</Text>
        </View>
      )}

      <Text style={styles.title}>Comparrison Photo</Text>
      <Text style={styles.text}>This photo will be used to compare</Text>

      <View style={styles.buttonContainer}>
        <CustomButton title="Capture Image" onPress={captureImage} />
        <CustomButton
          title="Compare"
          onPress={() => {
            if (selectedAsset && enrolledAsset) {
              compareFaces();
            } else {
              Alert.alert('Missing Images', 'Please ensure both enrollment and comparison photos are selected.');
            }
          }}
        />
        <CustomButton title="Reset" onPress={resetStages} />
      </View>
    </>
  );
};


const DetectEyeScreen = () => {
  const [livenessCheck, setLivenessCheck] = useState(null);

  const determineCheck = () => {
    const checkEyesClosed = Math.random() < 0.5;
    setLivenessCheck(checkEyesClosed ? 'eyes' : 'smile');
  };

  useEffect(() => {
    determineCheck();
  }, []);

  return (
    <>
      {imageUri ? (
        <View style={styles.imageContainer}>
          <Image source={{ uri: imageUri }} style={styles.imagePreview} />
        </View>
      ) : (
        <View style={styles.imagePlaceholder}>
          {uploading ? (
            <>
              <ActivityIndicator size="large" color="#0000ff" />
              <Text>{uploadProgress}%</Text>
            </>
          ) : (
            <Image source={closerImage} style={styles.defaultImage} />
          )}
        </View>
      )}
      <Text style={styles.title}>Take A Photo</Text>
      {livenessCheck === 'eyes' && (
        <Text style={styles.text}>Please close your eyes and take a new photo.</Text>
      )}
      {livenessCheck === 'smile' && (
        <Text style={styles.text}>Please smile and take a new photo.</Text>
      )}
      <CustomButton title="Capture Image" onPress={captureImage} />
      <CustomButton
        title="Detect Liveness"
        onPress={() => {
          detectLiveness(livenessCheck);
        }}
      />
      <CustomButton title="Reset" onPress={resetStages} />
    </>
  );
};


const CompletedAuthScreen = () => {
  return (
    <>
      <FireworkParticles count={50} colors={['#ff4081', '#7c4dff', '#ffea00', '#00e676']} duration={5000} />
      <View style={styles.authenticatedContainer}>
        <Text style={styles.title}>You have been Authenticated !</Text>
        <CustomButton title="Reset" onPress={resetStages} />
      </View>
    </>
  );
};



return (
  <ScrollView contentContainerStyle={styles.container} style={styles.scrollView}>
      {stage === 0 && <WelcomeScreen />}
      {stage === 1 && <EnrollmentScreen />}
      {stage === 2 && <SecuritySetupScreen />}
      {stage === 3 && <HomeScreen />}  
      {stage === 4 && <CaptureImageScreen />}
      {stage === 5 && <DetectEyeScreen />}
      {stage === 6 && <CompletedAuthScreen />}
  </ScrollView>
);
}

const styles = StyleSheet.create({
  scrollView: {
    backgroundColor: '#F0F0F0', // Set the same background color as the container
    flex: 1, // Make sure it fills the whole screen
  },
  welcomeContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    flex: 1,
    marginBottom: 100,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  welcomeText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  text: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
  },
  securitySetupContainer: {
    flex: 1,
    justifyContent: 'center', // Center content vertically
    alignItems: 'center', // Center content horizontally
    backgroundColor: '#FFFFFF', // Assuming a white background
    padding: 20, // Adjust as needed
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20, // Space below the title
    color: '#000000', // Assuming a black title
  },
  text: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30, // Space below the text
    color: '#333333', // Dark grey text for instructions
  },
  inputWrapper: {
    width: '80%', // Same as your input width to maintain alignment
    borderBottomWidth: 1, // Set the thickness of the line
    borderBottomColor: '#000000', // Set the color of the line
    marginBottom: 15, // Space between each input
  },
  input: {
    backgroundColor: '#FFFFFF', // Assuming a white background for input
    fontSize: 16, // Input text size
    color: '#000000', // Input text color
    paddingVertical: 10, // Padding above and below the text
    paddingHorizontal: 20, // Padding on the sides will make the line shorter than the full width
    textAlign: 'center', // Centers the text inside the input field
  },
  modelView: {
    width: 400,
    height: 50, 
    backgroundColor: 'transparent',

    
  },
  particleContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: -1,
  },
  container: {
    minHeight: windowHeight, // Minus the padding from the top and bottom
    justifyContent: 'center', // This will center the content vertically
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    padding: 20,
    paddingBottom: 20, // You can adjust this as needed
  },
  imageContainer: {
    width: 200,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    // Reduce the top margin to lower the image
    marginTop: 20,
    marginBottom: 50,
    backgroundColor: '#e1e1e1',
    borderRadius: 10,
    overflow: 'hidden',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    width: 200, // Set a fixed width
    height: 200, // Set a fixed height
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#cccccc',
    marginTop: 20,
    marginBottom: 50,
    borderRadius: 10, // Add border radius for consistency
  },

  authenticatedContainer: {
    marginTop: 100, // Adjust this value as needed to move the content down
    alignItems: 'center', // Center children horizontally
    width: '100%', // Ensure the container takes the full width
    // other styles if needed
  },
  defaultImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
    borderRadius : 15,
  },
  buttonContainer: {
    alignSelf: 'stretch', // Ensure the container takes the full width available
    alignItems: 'center', // Center the buttons horizontally
    marginTop: 20, // Space between image container and button container
  },
  buttonWrapper: {
    width: '80%', // Set width relative to the parent container
    marginBottom: 10, // Add bottom margin to each button
    borderRadius: 25, // Rounded corners for buttons
    overflow: 'hidden', // Ensures the button background does not bleed outside the border radius
  },
  // Custom button styling
  button: {
    backgroundColor: '#6C63FF', // A pleasant purple shade for the button background
    paddingVertical: 10, // Vertical padding for the button
    paddingHorizontal: 20, // Horizontal padding for the button
    shadowColor: 'rgba(0, 0, 0, 0.1)', // Shadow color
    shadowOffset: { width: 0, height: 4 }, // Shadow offset
    shadowOpacity: 1, // Shadow opacity
    shadowRadius: 3, // Shadow radius
    elevation: 3, // Elevation for Android
  },
  buttonText: {
    color: 'white', // White text color for the buttons
    textAlign: 'center', // Center text within the button
    fontWeight: '600', // Slightly bold font for the button text
    fontSize: 16, // Font size for the button text
  },
});
