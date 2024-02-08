//proto type 2
const express = require('express');
const aws = require('aws-sdk');
const app = express();
const path = require('path');

app.use(express.static('public'));

// Configure AWS SDK
aws.config.update({
    accessKeyId: 'AKIAV6FHEIYOV7JSII6Q',
    secretAccessKey: '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',
    region: 'eu-west-2'
});

// Create an S3 instance
const s3 = new aws.S3();
const rekognition = new aws.Rekognition();

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

app.get('/analyze', (req, res) => {
    const bucketName = 'joeimagebucket';
    const key = 'image2.jpg'; // the key of the image in the S3 bucket

    const params = {
        Image: {
            S3Object: {
                Bucket: bucketName,
                Name: key,
            },
        },
    };

    rekognition.detectLabels(params, (err, data) => {
        if (err) {
            console.log(err, err.stack); // an error occurred
            res.status(500).send(err);
        } else {
            console.log(data); // successful response
            res.send(data);
        }
    });
});


app.get('/image', (req, res) => {
    const bucketName = 'joeimagebucket';
    const key = 'image2.jpg'; // the key of the image in the S3 bucket

    // Parameters for S3 getObject call
    const params = {
        Bucket: bucketName,
        Key: key,
    };

    // Get the image from S3 and send it to the client
    s3.getObject(params, (err, data) => {
        if (err) {
            // handle error
            console.log(err);
            res.status(500).send("Error getting image");
        } else {
            // Set the content-type header and send the image
            res.writeHead(200, {'Content-Type': data.ContentType});
            res.write(data.Body, 'binary');
            res.end(null, 'binary');
        }
    });
});

// Start the server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

// Access key - AKIAV6FHEIYOV7JSII6Q
// Secret access key - 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




