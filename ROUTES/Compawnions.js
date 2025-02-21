const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");
const cookieParser = require("cookie-parser");
const Compawnions = express.Router();

const secretKey = "sikretolangto";

// nodemailer setting
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "barkcodecompawnion@gmail.com",
    pass: "fmji xuvs akpb mrke",
  },
});

/**
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {import('@google-cloud/storage').Bucket} storage
 * @returns {express.Router}
 */
module.exports = function (db, storage) {


  // generates a compawnion ID
  async function getNextCompId() {
    const counterRef = db.collection("Counter").doc("CompIDCounter");

    try {
      const newCompId = await db.runTransaction(async (transaction) => {
        const counterDoc = await transaction.get(counterRef);

        if (!counterDoc.exists) {
          transaction.set(counterRef, { currentId: 1 });
          return 1;
        }

        const currentId = counterDoc.data().currentId || 0;
        const updatedId = currentId + 1;
        transaction.update(counterRef, { currentId: updatedId });

        return updatedId;
      });

      return newCompId;
    } catch (error) {
      console.error("Error generating new Compawnion ID:", error);
      throw new Error("Failed to generate new Compawnion ID.");
    }
  }

  //Send registration email to Compawnion user.
  async function sendCompawnionRegistrationEmail(
    email,
    username,
    name,
    password
  ) {
    const mailOptions = {
      from: "barkcodecompawnion@gmail.com",
      to: email,
      subject: "Compawnion Registration Successful",
      html: `
        <h1>Welcome to Compawnion!</h1>
        <p>Dear ${name},</p>
        <p>Your account has been successfully registered. Here are your details:</p>
        <ul>
          <li><strong>Name:</strong> ${name}</li>
          <li><strong>Username:</strong> ${username}</li>
          <li><strong>Email:</strong> ${email}</li>
          <li><strong>App Pet ID:</strong> ${appPetID}</li>
        </ul>
        <p>Thank you for choosing to be a COMPAWNION!</p>
      `,
    };

    await transporter.sendMail(mailOptions);
  }


  // Register Compawnion
  Compawnions.post("/register", async (req, res) => {
    const {
      accountCreate: { Name, Username, Email, Password, Profile },
      appPetID,
    } = req.body;

    if (!appPetID) {
      return res.status(400).json({ message: "appPetID is required." });
    }

    try {
      // Check if the appPetID exists in AdoptedAnimals collection
      const adoptedAnimalRef = db.collection("AdoptedAnimals").doc(appPetID);
      const adoptedAnimalDoc = await adoptedAnimalRef.get();

      if (!adoptedAnimalDoc.exists) {
        return res
          .status(404)
          .json({ message: "Invalid appPetID. Adoption not found." });
      }

      // Check if appPetID already exists in Compawnions collection
      const existingPetIdSnapshot = await db
        .collection("Compawnions")
        .where("CompawnionUser.appPetID", "==", appPetID)
        .limit(1) // Stop as soon as one match is found
        .get();

      if (!existingPetIdSnapshot.empty) {
        console.log(`Duplicate appPetID detected: ${appPetID}`);
        return res.status(400).json({
          message: "This appPetID is already associated with another account.",
        });
      }

      // Check for duplicate username
      const existingUserSnapshot = await db
        .collection("Compawnions")
        .where("CompawnionUser.accountCreate.Username", "==", Username)
        .limit(1)
        .get();

      if (!existingUserSnapshot.empty) {
        return res.status(400).json({ message: "Username already exists." });
      }

      // Check for duplicate email
      const existingEmailSnapshot = await db
        .collection("Compawnions")
        .where("CompawnionUser.accountCreate.Email", "==", Email)
        .limit(1)
        .get();

      if (!existingEmailSnapshot.empty) {
        return res.status(400).json({ message: "Email already in use." });
      }

      // Send the email with unencrypted password before hashing it
      await sendCompawnionRegistrationEmail(Email, Username, Name, Password);

      // Hash the password
      const hashedPassword = await bcrypt.hash(Password, 10);

      // Generate Compawnion ID
      const compId = await getNextCompId();
      const formattedCompId = compId.toString().padStart(3, "0");

      // Create a new Compawnion document
      const newCompanionData = {
        CompawnionUser: {
          accountCreate: {
            Username,
            Email,
            Password: hashedPassword,
            Profile: Profile || null, // Set to null if not provided
          },
          MedSched: [],
          TrustedVet: [],
          CompawnionSched: [],
          appPetID, // Link to adopted pet
        },
        Status: "Inactive", // Default status
        LastLogin: null,
        LastLogout: null,
      };

      await db
        .collection("Compawnions")
        .doc(formattedCompId)
        .set(newCompanionData);

      res.status(201).json({
        message: `Compawnion registered successfully with ID: ${formattedCompId}`,
      });
    } catch (error) {
      console.error("Error registering compawnion:", error);
      res.status(500).json({
        message: "Failed to register compawnion.",
        error: error.message,
      });
    }
  });

  // Login route
  Compawnions.post("/login", async (req, res) => {
    const { Username, Password, rememberMe } = req.body;

    try {
      // Retrieve the user based on the provided username
      const userSnapshot = await db
        .collection("Compawnions")
        .where("CompawnionUser.accountCreate.Username", "==", Username)
        .get();

      // Check if the user exists
      if (userSnapshot.empty) {
        return res.status(404).json({ message: "User not found." });
      }

      // Get the user data
      const userData = userSnapshot.docs[0].data();

      // Compare the provided password with the hashed password stored in database
      const isMatch = await bcrypt.compare(
        Password,
        userData.CompawnionUser.accountCreate.Password
      ); 

      if (!isMatch) {
        return res.status(401).json({ message: "Invalid credentials." });
      }

      // Fetch the appPetID associated with the compawnion
      const appPetID = userData.CompawnionUser.appPetID;

      if (!appPetID) {
        return res
          .status(400)
          .json({ message: "No associated pet found for this compawnion." });
      }

      // Check if the appPetID exists in the AdoptedAnimals collection
      const adoptedAnimalRef = db.collection("AdoptedAnimals").doc(appPetID);
      const adoptedAnimalDoc = await adoptedAnimalRef.get();

      if (!adoptedAnimalDoc.exists) {
        return res.status(404).json({
          message: "No adopted animal found with the provided appPetID.",
        });
      }

      // Retrieve the adopted animal data (optional, can return in response if needed)
      const adoptedAnimalData = adoptedAnimalDoc.data();

      // Update the user's status and last login timestamp
      const loginTimestamp = new Date().toISOString();
      await userSnapshot.docs[0].ref.update({
        Status: "Active",
        LastLogin: loginTimestamp,
      });

      // Set the token expiration based on the "rememberMe" flag
      const expiresIn = rememberMe ? "7d" : "1h"; // 7 days for rememberMe, 1 hour for normal login

      // Generate token
      const token = jwt.sign({ Username }, secretKey, { expiresIn });

      // Set JWT cookie with token
      res.cookie("token", token, {
        httpOnly: true, // Prevent access to the cookie via JavaScript
        secure: false, // Set to true for production (HTTPS)
        maxAge: rememberMe ? 7 * 24 * 60 * 60 * 1000 : 60 * 60 * 1000, // Expiration time (7 days or 1 hour)
      });

      res.json({
        message: "Login successful",
        token,
        appPetID,
        companionId: userSnapshot.docs[0].id,
      });
    } catch (error) {
      console.error("Error logging in:", error);
      res.status(500).json({ message: "Failed to log in." });
    }
  });

  // Logout route
  Compawnions.post("/logout", (req, res) => {
    // Clear the JWT token cookie
    res.clearCookie("token");

    res.json({ message: "Logout successful." });
  });

  Compawnions.post("/authenticate", async (req, res) => {
    const { authToken } = req.body;
    if (!authToken) {
      res.json({ message: "Pleace Provide Authentication Token." });
      return;
    }

    try {
      jwt.verify(authToken, secretKey, {});

      res.send({ message: "Valid Session.", valid: true });
    } catch (error) {
      res.send({ message: "In Session.", valid: false });
    }
  });

  Compawnions.post("/forgotPassword", async (req, res) => {
    try {
      const { email } = req.body;

      // Validate input
      if (!email) {
        return res.status(400).json({ message: "Email is required." });
      }

      // Check if the email exists in the database
      const snapshot = await db
        .collection("Compawnions")
        .where("CompawnionUser.accountCreate.Email", "==", email)
        .get();

      if (snapshot.empty) {
        return res.status(404).json({ message: "Email not found." });
      }

      // Generate a verification code (6-digit)
      const verificationCode = Math.floor(100000 + Math.random() * 900000);

      // Save the verification code in the database for the user
      const docId = snapshot.docs[0].id;
      await db
        .collection("Compawnions")
        .doc(docId)
        .update({
          "CompawnionUser.resetCode": verificationCode,
          "CompawnionUser.resetCodeExpires": Date.now() + 15 * 60 * 1000, // 15-minute expiration
        });

      // Send the verification code via email
      await sendVerificationEmail(email, verificationCode);

      res.json({ message: "Verification code sent to email." });
    } catch (error) {
      console.error("Error in resetPassword:", error);
      res.status(500).json({ message: "Error sending reset password email." });
    }
  });

  // verification code 
  async function sendVerificationEmail(email, verificationCode) {
    const mailOptions = {
      from: "barkcodecompawnion@gmail.com",
      to: email,
      subject: "Reset Password Verification Code",
      html: `
        <h1>Reset Your Password</h1>
        <p>We received a request to reset your password. Use the verification code below to proceed:</p>
        <h2>${verificationCode}</h2>
        <p>This code is valid for 15 minutes.</p>
        <p>If you did not request a password reset, please ignore this email.</p>
      `,
    };

    await transporter.sendMail(mailOptions);
  }

  Compawnions.post("/forgotPassword/verify", async (req, res) => {
    try {
      const { resetCode } = req.body;

      // Validate input
      if (!resetCode) {
        return res.status(400).json({ message: "Reset code is required." });
      }

      // Convert entered reset code to a number
      const enteredResetCode = Number(resetCode);

      // Fetch user by reset code from the database
      const snapshot = await db
        .collection("Compawnions")
        .where("CompawnionUser.resetCode", "==", enteredResetCode)
        .get();

      if (snapshot.empty) {
        return res.status(404).json({ message: "Invalid verification code." });
      }

      const docId = snapshot.docs[0].id;
      const userDoc = snapshot.docs[0].data();
      const storedResetCode = userDoc.CompawnionUser.resetCode; // Stored as a number

      console.log("Stored Reset Code:", storedResetCode);
      console.log("Entered Reset Code:", enteredResetCode);

      // Check if the reset codes match
      if (storedResetCode !== enteredResetCode) {
        return res.status(404).json({ message: "Invalid verification code." });
      }

      const resetCodeExpires = userDoc.CompawnionUser.resetCodeExpires;

      // Check if the reset code has expired
      if (Date.now() > resetCodeExpires) {
        return res
          .status(400)
          .json({ message: "Verification code has expired." });
      }

      res.json({ message: "Verification code is valid." });
    } catch (error) {
      console.error("Error in resetPassword/verify:", error);
      res.status(500).json({ message: "Error verifying the reset code." });
    }
  });

  // Read All Companions
  Compawnions.get("/", async (req, res) => {
    try {
      const snapshot = await db.collection("Compawnions").get();
      const companions = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      res.json({
        message: "Companions retrieved successfully.",
        data: companions,
      });
    } catch (error) {
      res.status(500).json({ message: "Error retrieving Companions." });
    }
  });

  // Read a specific Compawnion by ID
  Compawnions.get("/:id", async (req, res) => {
    try {
      const userId = req.params.id;
      const userRef = db.collection("Compawnions").doc(userId);
      const doc = await userRef.get();

      if (!doc.exists) {
        return res.status(404).json({ message: "Compawnion not found." });
      }
      res.json({
        message: "Compawnion retrieved successfully.",
        data: { id: doc.id, ...doc.data() },
      });
    } catch (error) {
      res.status(500).json({ message: "Error retrieving Companion." });
    }
  });

  Compawnions.post("/addMedSched/:companionId", async (req, res) => {
    const { companionId } = req.params;
    const { MedSched } = req.body;

    if (!MedSched) {
      return res.status(400).json({
        message: "All MedSched fields are required.",
      });
    }

    const { SchedTitle, SchedDate, SchedTime, SchedVetClinic, SchedPet } =
      MedSched;
    if (
      !SchedTitle ||
      !SchedDate ||
      !SchedTime ||
      !SchedVetClinic ||
      !SchedPet
    ) {
      return res.status(400).json({
        message:
          "MedSched must include SchedTitle, SchedDate, SchedTime, SchedVetClinic, and SchedPet.",
      });
    }

    try {
      const userRef = db.collection("Compawnions").doc(companionId);
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        return res.status(404).json({ message: "Companion not found." });
      }

      const medSchedArray = userDoc.data().CompawnionUser.MedSched || [];
      await userRef.update({
        "CompawnionUser.MedSched": medSchedArray.concat(MedSched),
      });
      res.json({ message: "MedSched added successfully." });
    } catch (error) {
      console.error("Error adding MedSched:", error);
      res
        .status(500)
        .json({ message: "Failed to add MedSched.", error: error.message });
    }
  });

  Compawnions.post("/addTrustedVet/:companionId", async (req, res) => {
    const { companionId } = req.params;
    const { TrustedVet } = req.body;

    if (!TrustedVet) {
      return res.status(400).json({
        message: "All TrustedVet fields are required.",
      });
    }

    const { TVVetClinic, TVAddress } = TrustedVet;
    if (!TVVetClinic || !TVAddress) {
      return res.status(400).json({
        message: "TrustedVet must include TVVetClinic and TVAddress.",
      });
    }

    try {
      const userRef = db.collection("Compawnions").doc(companionId);
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        return res.status(404).json({ message: "Companion not found." });
      }

      const trustedVetArray = userDoc.data().CompawnionUser.TrustedVet || [];
      await userRef.update({
        "CompawnionUser.TrustedVet": trustedVetArray.concat(TrustedVet),
      });
      res.json({ message: "TrustedVet added successfully." });
    } catch (error) {
      console.error("Error adding TrustedVet:", error);
      res
        .status(500)
        .json({ message: "Failed to add TrustedVet.", error: error.message });
    }
  });

  Compawnions.post("/addCompawnionSched/:companionId", async (req, res) => {
    const { companionId } = req.params;
    const { CompawnionSched } = req.body;

    if (!CompawnionSched) {
      return res.status(400).json({
        message: "All CompawnionSched fields are required.",
      });
    }

    const { EventTitle, CSDate, CSTime, GmeetRoom } = CompawnionSched;
    if (!EventTitle || !CSDate || !CSTime || !GmeetRoom) {
      return res.status(400).json({
        message:
          "CompawnionSched must include EventTitle, CSDate, CSTime, and GmeetRoom.",
      });
    }

    try {
      const userRef = db.collection("Compawnions").doc(companionId);
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        return res.status(404).json({ message: "Companion not found." });
      }

      const compawnionSchedArray =
        userDoc.data().CompawnionUser.CompawnionSched || [];
      await userRef.update({
        "CompawnionUser.CompawnionSched":
          compawnionSchedArray.concat(CompawnionSched),
      });
      res.json({ message: "CompawnionSched added successfully." });
    } catch (error) {
      console.error("Error adding CompawnionSched:", error);
      res.status(500).json({
        message: "Failed to add CompawnionSched.",
        error: error.message,
      });
    }
  });

  // Get response for companion details
  Compawnions.get("/schedules/:companionId", async (req, res) => {
    const { companionId } = req.params; // Extract companionId from route parameters

    if (!companionId) {
      return res.status(400).json({ message: "Companion ID is required." });
    }

    try {
      // Locate the companion document by ID
      const userDoc = await db.collection("Compawnions").doc(companionId).get();

      if (!userDoc.exists) {
        return res.status(404).json({ message: "Companion not found." });
      }

      // Extract the user's details
      const userData = userDoc.data().CompawnionUser;

      const companionDetails = {
        MedSched: userData.MedSched || [],
        TrustedVet: userData.TrustedVet || [],
        CompawnionSched: userData.CompawnionSched || [],
      };

      res.json({
        message: "Companion details retrieved successfully.",
        data: companionDetails,
      });
    } catch (error) {
      console.error("Error retrieving companion details:", error); // Log the error
      res.status(500).json({
        message: "Failed to retrieve companion details.",
        error: error.message,
      }); // Include error message in response
    }
  });

  // Route to get MedSched details
  Compawnions.get("/MedSched/:companionId", async (req, res) => {
    const { companionId } = req.params;

    if (!companionId) {
      return res.status(400).json({ message: "Companion ID is required." });
    }

    try {
      const userDoc = await db.collection("Compawnions").doc(companionId).get();

      if (!userDoc.exists) {
        return res.status(404).json({ message: "Companion not found." });
      }

      const medSched = userDoc.data().CompawnionUser?.MedSched || [];
      res.json({
        message: "MedSched details retrieved successfully.",
        data: medSched,
      });
    } catch (error) {
      console.error("Error retrieving MedSched details:", error);
      res.status(500).json({
        message: "Failed to retrieve MedSched details.",
        error: error.message,
      });
    }
  });

  // Route to get TrustedVet details
  Compawnions.get("/TrustedVet/:companionId", async (req, res) => {
    const { companionId } = req.params;

    if (!companionId) {
      return res.status(400).json({ message: "Companion ID is required." });
    }

    try {
      const userDoc = await db.collection("Compawnions").doc(companionId).get();

      if (!userDoc.exists) {
        return res.status(404).json({ message: "Companion not found." });
      }

      const trustedVet = userDoc.data().CompawnionUser?.TrustedVet || [];
      res.json({
        message: "TrustedVet details retrieved successfully.",
        data: trustedVet,
      });
    } catch (error) {
      console.error("Error retrieving TrustedVet details:", error);
      res.status(500).json({
        message: "Failed to retrieve TrustedVet details.",
        error: error.message,
      });
    }
  });

  // Route to get CompawnionSched details
  Compawnions.get("/CompawnionSched/:companionId", async (req, res) => {
    const { companionId } = req.params;

    if (!companionId) {
      return res.status(400).json({ message: "Companion ID is required." });
    }

    try {
      const userDoc = await db.collection("Compawnions").doc(companionId).get();

      if (!userDoc.exists) {
        return res.status(404).json({ message: "Companion not found." });
      }

      const compawnionSched =
        userDoc.data().CompawnionUser?.CompawnionSched || [];
      res.json({
        message: "CompawnionSched details retrieved successfully.",
        data: compawnionSched,
      });
    } catch (error) {
      console.error("Error retrieving CompawnionSched details:", error);
      res.status(500).json({
        message: "Failed to retrieve CompawnionSched details.",
        error: error.message,
      });
    }
  });

  // Get the adopted animal owned by the Companion using their appPetID
  Compawnions.get("/myPets/:companionId", async (req, res) => {
    const { companionId } = req.params;

    try {
      // Retrieve Companion document by companionId
      const companionRef = db.collection("Compawnions").doc(companionId);
      const companionDoc = await companionRef.get();

      if (!companionDoc.exists) {
        return res.status(404).json({ message: "Companion not found." });
      }

      // Get the appPetID from the Companion document
      const appPetID = companionDoc.data().CompawnionUser.appPetID;

      if (!appPetID) {
        return res.status(404).json({
          message: "No adopted animal associated with this companion.",
        });
      }

      const adoptedAnimalRef = db.collection("AdoptedAnimals").doc(appPetID);
      const adoptedAnimalDoc = await adoptedAnimalRef.get();

      if (!adoptedAnimalDoc.exists) {
        return res.status(404).json({ message: "Adopted animal not found." });
      }

      // Return the adopted animal data
      res.json({
        message: "Adopted animal retrieved successfully.",
        data: adoptedAnimalDoc.data(),
      });
    } catch (error) {
      console.error("Error retrieving adopted animal:", error);
      res.status(500).json({ message: "Error retrieving adopted animal." });
    }
  });

  // Update Compawnion's account information, including Profile
  Compawnions.put("/accountUpdate/:companionId", async (req, res) => {
    try {
      const companionId = req.params.companionId;
      const { accountCreate } = req.body;

      if (!accountCreate) {
        return res
          .status(400)
          .json({ message: "accountCreate data is required." });
      }

      // Check if the new password is provided and hash it
      if (accountCreate.Password) {
        accountCreate.Password = await bcrypt.hash(accountCreate.Password, 10);
      }

      const userRef = db.collection("Compawnions").doc(companionId);

      const userDoc = await userRef.get();
      if (!userDoc.exists) {
        return res.status(404).json({ message: "Companion not found." });
      }

      // Update the accountCreate subfield with the new data, including Profile
      await userRef.update({
        "CompawnionUser.accountCreate": {
          ...userDoc.data().CompawnionUser.accountCreate,
          ...accountCreate, 
        },
      });

      res.json({ message: "Companion account updated successfully." });
    } catch (error) {
      console.error("Error updating companion account:", error);
      res.status(500).json({ message: "Error updating companion account." });
    }
  });

  Compawnions.put("/changePassword/:companionId", async (req, res) => {
    try {
      const companionId = req.params.companionId;
      const { username, currentPassword, newPassword, confirmNewPassword } =
        req.body;

      // Validate inputs
      if (!currentPassword || !newPassword || !confirmNewPassword) {
        return res
          .status(400)
          .json({ message: "All password fields are required." });
      }

      if (newPassword !== confirmNewPassword) {
        return res.status(400).json({ message: "New passwords do not match." });
      }

      const userRef = db.collection("Compawnions").doc(companionId);
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        return res.status(404).json({ message: "Companion not found." });
      }

      const userData = userDoc.data();
      const storedPassword = userData?.CompawnionUser?.accountCreate?.Password;

      // Check if current password matches
      const isPasswordCorrect = await bcrypt.compare(
        currentPassword,
        storedPassword
      );
      if (!isPasswordCorrect) {
        return res
          .status(401)
          .json({ message: "Current password is incorrect." });
      }

      // Hash the new password
      const hashedNewPassword = await bcrypt.hash(newPassword, 10);

      // Update the password in the database
      await userRef.update({
        "CompawnionUser.accountCreate.Password": hashedNewPassword,
      });

      res.json({ message: "Password changed successfully." });
    } catch (error) {
      console.error("Error changing password:", error);
      res.status(500).json({ message: "Error changing password." });
    }
  });

  Compawnions.put("/updateMedSched/:companionId/:index", async (req, res) => {
    const { companionId, index } = req.params;
    const indexNumber = parseInt(index, 10);
    const { MedSched } = req.body;

    if (isNaN(indexNumber)) {
      return res.status(400).json({
        message: "Invalid index provided.",
      });
    }

    if (!MedSched) {
      return res.status(400).json({
        message: "MedSched data is required for updating.",
      });
    }

    try {
      const userRef = db.collection("Compawnions").doc(companionId);
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        return res.status(404).json({ message: "Companion not found." });
      }

      let medSchedArray = userDoc.data().CompawnionUser.MedSched || [];

      if (indexNumber < 0 || indexNumber >= medSchedArray.length) {
        return res.status(400).json({
          message: "Index out of bounds.",
        });
      }

      medSchedArray[indexNumber] = MedSched;

      await userRef.update({
        "CompawnionUser.MedSched": medSchedArray,
      });

      res.json({ message: "MedSched updated successfully." });
    } catch (error) {
      console.error("Error updating MedSched:", error);
      res.status(500).json({
        message: "Failed to update MedSched.",
        error: error.message,
      });
    }
  });

  Compawnions.put("/updateTrustedVet/:companionId/:index", async (req, res) => {
    const { companionId, index } = req.params;
    const indexNumber = parseInt(index, 10);
    const { TrustedVet } = req.body;

    if (isNaN(indexNumber)) {
      return res.status(400).json({
        message: "Invalid index provided.",
      });
    }

    if (!TrustedVet) {
      return res.status(400).json({
        message: "TrustedVet data is required for updating.",
      });
    }

    try {
      const userRef = db.collection("Compawnions").doc(companionId);
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        return res.status(404).json({ message: "Companion not found." });
      }

      let trustedVetArray = userDoc.data().CompawnionUser.TrustedVet || [];

      if (indexNumber < 0 || indexNumber >= trustedVetArray.length) {
        return res.status(400).json({
          message: "Index out of bounds.",
        });
      }

      trustedVetArray[indexNumber] = TrustedVet;

      await userRef.update({
        "CompawnionUser.TrustedVet": trustedVetArray,
      });

      res.json({ message: "TrustedVet updated successfully." });
    } catch (error) {
      console.error("Error updating TrustedVet:", error);
      res.status(500).json({
        message: "Failed to update TrustedVet.",
        error: error.message,
      });
    }
  });

  Compawnions.put(
    "/updateCompawnionSched/:companionId/:index",
    async (req, res) => {
      const { companionId, index } = req.params;
      const indexNumber = parseInt(index, 10);
      const { CompawnionSched } = req.body;

      if (isNaN(indexNumber)) {
        return res.status(400).json({
          message: "Invalid index provided.",
        });
      }

      if (!CompawnionSched) {
        return res.status(400).json({
          message: "CompawnionSched data is required for updating.",
        });
      }

      try {
        const userRef = db.collection("Compawnions").doc(companionId);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
          return res.status(404).json({ message: "Companion not found." });
        }

        let compawnionSchedArray =
          userDoc.data().CompawnionUser.CompawnionSched || [];

        if (indexNumber < 0 || indexNumber >= compawnionSchedArray.length) {
          return res.status(400).json({
            message: "Index out of bounds.",
          });
        }

        compawnionSchedArray[indexNumber] = CompawnionSched;

        await userRef.update({
          "CompawnionUser.CompawnionSched": compawnionSchedArray,
        });

        res.json({ message: "CompawnionSched updated successfully." });
      } catch (error) {
        console.error("Error updating CompawnionSched:", error);
        res.status(500).json({
          message: "Failed to update CompawnionSched.",
          error: error.message,
        });
      }
    }
  );

  // Delete Companion
  Compawnions.delete("/:id", async (req, res) => {
    try {
      const userId = req.params.id;
      const userRef = db.collection("Compawnions").doc(userId);
      await userRef.delete();
      res.json({ message: "Companion deleted successfully." });
    } catch (error) {
      res.status(500).json({ message: "Error deleting Companion." });
    }
  });

  Compawnions.delete(
    "/deleteMedSched/:companionId/:index",
    async (req, res) => {
      const { companionId, index } = req.params;
      const indexNumber = parseInt(index, 10);

      if (isNaN(indexNumber)) {
        return res.status(400).json({
          message: "Invalid index provided.",
        });
      }

      try {
        const userRef = db.collection("Compawnions").doc(companionId);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
          return res.status(404).json({ message: "Companion not found." });
        }

        let medSchedArray = userDoc.data().CompawnionUser.MedSched || [];

        if (indexNumber < 0 || indexNumber >= medSchedArray.length) {
          return res.status(400).json({
            message: "Index out of bounds.",
          });
        }

        medSchedArray.splice(indexNumber, 1);

        await userRef.update({
          "CompawnionUser.MedSched": medSchedArray,
        });

        res.json({ message: "MedSched deleted successfully." });
      } catch (error) {
        console.error("Error deleting MedSched:", error);
        res.status(500).json({
          message: "Failed to delete MedSched.",
          error: error.message,
        });
      }
    }
  );

  Compawnions.delete(
    "/deleteTrustedVet/:companionId/:index",
    async (req, res) => {
      const { companionId, index } = req.params;
      const indexNumber = parseInt(index, 10);

      if (isNaN(indexNumber)) {
        return res.status(400).json({
          message: "Invalid index provided.",
        });
      }

      try {
        const userRef = db.collection("Compawnions").doc(companionId);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
          return res.status(404).json({ message: "Companion not found." });
        }

        let trustedVetArray = userDoc.data().CompawnionUser.TrustedVet || [];

        if (indexNumber < 0 || indexNumber >= trustedVetArray.length) {
          return res.status(400).json({
            message: "Index out of bounds.",
          });
        }

        trustedVetArray.splice(indexNumber, 1);

        await userRef.update({
          "CompawnionUser.TrustedVet": trustedVetArray,
        });

        res.json({ message: "TrustedVet deleted successfully." });
      } catch (error) {
        console.error("Error deleting TrustedVet:", error);
        res.status(500).json({
          message: "Failed to delete TrustedVet.",
          error: error.message,
        });
      }
    }
  );

  Compawnions.delete(
    "/deleteCompawnionSched/:companionId/:index",
    async (req, res) => {
      const { companionId, index } = req.params;
      const indexNumber = parseInt(index, 10);

      if (isNaN(indexNumber)) {
        return res.status(400).json({
          message: "Invalid index provided.",
        });
      }

      try {
        const userRef = db.collection("Compawnions").doc(companionId);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
          return res.status(404).json({ message: "Companion not found." });
        }

        let compawnionSchedArray =
          userDoc.data().CompawnionUser.CompawnionSched || [];

        if (indexNumber < 0 || indexNumber >= compawnionSchedArray.length) {
          return res.status(400).json({
            message: "Index out of bounds.",
          });
        }

        compawnionSchedArray.splice(indexNumber, 1);

        await userRef.update({
          "CompawnionUser.CompawnionSched": compawnionSchedArray,
        });

        res.json({ message: "CompawnionSched deleted successfully." });
      } catch (error) {
        console.error("Error deleting CompawnionSched:", error);
        res.status(500).json({
          message: "Failed to delete CompawnionSched.",
          error: error.message,
        });
      }
    }
  );

  return Compawnions;
};
