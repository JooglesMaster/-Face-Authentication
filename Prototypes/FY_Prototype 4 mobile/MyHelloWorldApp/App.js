import React, { useState } from 'react';
import { StyleSheet, View,Image, Alert,ActivityIndicator, Text,ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import AWS from 'aws-sdk';

const windowHeight = Dimensions.get('window').height;

export default function App() {

  const [imageUri, setImageUri] = useState(null);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [responseText, setresponseText] = useState('hello');
  const [uploadProgress, setUploadProgress] = useState(0); // New state for upload progress
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
// Function to handle image selection
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
  // Make sure that we have permission to use the camera
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
    setImageUri(result.uri); // Set the image URI directly if using `launchCameraAsync`
    setSelectedAsset(result); // Set the entire result as the selected asset
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
      console.error(err, err.stack); // an error occurred
      Alert.alert('Comparison Failed', err.message);
    } else {
      console.log(response); // successful response
      // Handle the response
      // For example, if the Similarity is above a certain threshold, you can consider the faces as matching
      if (response.FaceMatches && response.FaceMatches.length > 0) {
        const match = response.FaceMatches[0];
        Alert.alert('Match Found', `Similarity: ${match.Similarity}%`);
      } else {
        Alert.alert('No Match Found', 'The faces do not match.');
      }
    }
  });
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
    <View style={styles.imageContainer}>
      {!uploading && imageUri ? (
        <Image source={{ uri: imageUri }} style={styles.imagePreview} />
      ) : (
        // Display a placeholder if no image is present
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

    </View>
    <View style={styles.buttonContainer}>
      <CustomButton title="Select Image" onPress={selectImage} />
      <CustomButton title="Capture Image" onPress={captureImage} />
      <CustomButton title="Upload Image" onPress={uploadImageToS3} />
      <CustomButton title="Analyze" onPress={analyzeImage} />
      <CustomButton title="Compare Faces" onPress={compareFaces} />
    </View>
    <Text>{responseText}</Text>
  </ScrollView>
);
}

const styles = StyleSheet.create({
  scrollView: {
    backgroundColor: '#F0F0F0', // Set the same background color as the container
    flex: 1, // Make sure it fills the whole screen
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
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#cccccc', // Different color to distinguish the placeholder
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
