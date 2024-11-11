const admin = require("firebase-admin");
const fs = require("fs");

// Load service account key
const serviceAccount = require("./BarkCode.json");

// Initialize Firebase Admin SDK with your service account
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://compawnion-fbb5a-default-rtdb.asia-southeast1.firebasedatabase.app",
});

// Reference to Firestore
const db = admin.firestore();

// Recursive function to fetch documents and subcollections
async function fetchDocumentWithSubcollections(docRef) {
  const docSnapshot = await docRef.get();
  const docData = docSnapshot.data();
  const docId = docSnapshot.id;

  const subcollections = await docRef.listCollections();
  const subcollectionData = {};

  for (const subcollection of subcollections) {
    const subcollectionSnapshot = await subcollection.get();
    const subcollectionItems = [];

    subcollectionSnapshot.forEach((subDoc) => {
      subcollectionItems.push({
        id: subDoc.id,
        ...subDoc.data(),
      });
    });

    subcollectionData[subcollection.id] = subcollectionItems;
  }

  return {
    id: docId,
    data: docData,
    subcollections: subcollectionData,
  };
}

// Function to fetch Firestore data and save it to a JSON file
async function exportFirestoreToJson() {
  try {
    const collections = await db.listCollections(); // Get all collections
    const allData = {};

    for (const collection of collections) {
      const snapshot = await collection.get();
      const collectionData = [];

      for (const doc of snapshot.docs) {
        const docData = await fetchDocumentWithSubcollections(doc.ref);
        collectionData.push(docData);
      }

      allData[collection.id] = collectionData;
    }

    // Save the data to a JSON file
    fs.writeFileSync("firestoreData.json", JSON.stringify(allData, null, 2));
    console.log("Data successfully exported to firestoreData.json");
  } catch (error) {
    console.error("Error exporting Firestore data:", error);
  }
}

// Execute the function
exportFirestoreToJson();
