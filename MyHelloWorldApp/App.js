import React, { useState, useEffect} from 'react';
import { Suspense } from "react";
import { StyleSheet, View,Image, Alert,ActivityIndicator, Text,ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Canvas } from "@react-three/fiber/native";
import { ModelComponent } from './components/ModelComponent';
import AWS from 'aws-sdk';

const windowHeight = Dimensions.get('window').height;

export default function App() {

  const [imageUri, setImageUri] = useState(null);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [responseText, setresponseText] = useState('hello');
  const [uploadProgress, setUploadProgress] = useState(0); // New state for upload progress
  const [stage, setStage] = useState(0);
  const [initialHeadSize, setInitialHeadSize] = useState(null);
  
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

    if (stage === 1) {
      // Automatically proceed to the next stage after capturing the image in stage 1
      setStage(2);
    } else if (stage === 2) {
      detectEyes(); // Automatically detect eyes after capturing the image in stage 2
    }
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

    // Call the appropriate function based on the current stage
    if (stage === 0) {
      compareFaces();
    } else if (stage === 2) {
      detectEyes();
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
  if (!selectedAsset) {
    Alert.alert('No Image Selected', 'Please select an image first.'); 
    return;
  }

  const targetImageKey = selectedAsset.uri.split('/').pop();
  // You must have a reference to the source image, for example in your S3 bucket
  const sourceImageKey = 'image1.jpg'; // Replace with actual path to the source image

  const params = {
    SourceImage: {
      S3Object: {
        Bucket: 'joepicsapp',
        Name: sourceImageKey
      }
    },
    TargetImage: {
      S3Object: {
        Bucket: 'joeappimage',
        Name: targetImageKey
      }
    },
    SimilarityThreshold: 80 // Adjust the threshold as needed
  };

  rekognition.compareFaces(params, function(err, response) {
    if (err) {
      console.error(err, err.stack);
      Alert.alert('Comparison Failed', err.message);
    } else {
      console.log(response);
      if (response.FaceMatches && response.FaceMatches.length > 0) {
        const match = response.FaceMatches[0];
        if (match.Similarity > 97) {
          Alert.alert('Match Found', `Similarity: ${match.Similarity}%`);
          setStage(2);
          
          // Store the initial head size
          const initialSize = match.Face.BoundingBox;
          setInitialHeadSize(initialSize);
        } else {
          Alert.alert('Low Similarity', 'Please take another photo.', [
            { text: 'OK', onPress: () => setStage(0) } // Go back to stage 0 for taking another photo
          ]);
        }
      } else {
        Alert.alert('No Match Found', 'The faces do not match.', [
          { text: 'OK', onPress: () => setStage(0) } // Go back to stage 0 for taking another photo
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




const WelcomeScreen = ({ onStart }) => {
  return (
    <View style={styles.welcomeContainer}>
      <Canvas style={styles.modelView}>
        <ambientLight />
        <pointLight position={[10, 10, 10]} color="blue" intensity={2}/>
        <pointLight position={[-10, -10, -10]} color="blue" intensity={2} />
        <Suspense>
          <ModelComponent />
        </Suspense>
      </Canvas>
      <Text style={styles.welcomeTitle}>Welcome to the App!</Text>
      <Text style={styles.welcomeText}>This app allows you to perform face comparison and liveness detection.</Text>
      <CustomButton title="Get Started" onPress={onStart} />
    </View>
  );
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
return (
  <ScrollView contentContainerStyle={styles.container} style={styles.scrollView}>
    {stage === 0 && (
      <WelcomeScreen onStart={() => setStage(1)} />
    )}
    {stage === 1 && (
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
        <View style={styles.buttonContainer}>
          <CustomButton title="Capture Image" onPress={captureImage} />
          <CustomButton title="Reset" onPress={resetStages} />
        </View>
      </>
    )}
    {stage === 2 && (
      <>
        {imageUri && (
          <View style={styles.imageContainer}>
            <Image source={{ uri: imageUri }} style={styles.imagePreview} />
          </View>
        )}
        <Text style={styles.promptText}>Please close one eye and take a new photo.</Text>
        <CustomButton title="Capture Image" onPress={captureImage} />
        <CustomButton title="Reset" onPress={resetStages} />
      </>
    )}
    {stage === 3 && (
      <>
        <Text>Liveness detection result: {responseText}</Text>
        <CustomButton title="Reset" onPress={resetStages} />
      </>
    )}
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
  modelView: {
    width: 400,
    height: 50,
    backgroundColor: 'transparent',
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
    marginBottom: 20,
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
    borderRadius: 10, // Add border radius for consistency
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
