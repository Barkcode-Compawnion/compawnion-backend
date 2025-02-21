const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");
const Admins = express.Router();

const secretKey = "sikretolangto";

/**
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {import('@google-cloud/storage').Bucket} storage
 * @returns {express.Router}
 */
module.exports = function (db, storage) {
  // nodemailer setting
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "barkcodecompawnion@gmail.com",
      pass: "fmji xuvs akpb mrke",
    },
  });

  // Function to get and increment the next Admin ID automatically
  async function getNextAdminId() {
    const counterRef = db.collection("Counter").doc("AdminIDCounter");

    try {
      const newAdminId = await db.runTransaction(async (transaction) => {
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

      return newAdminId;
    } catch (error) {
      console.error("Error generating new Admin ID:", error);
      throw error;
    }
  }

  async function sendAdminRegistrationEmail(
    email,
    adminId,
    username,
    name,
    password
  ) {
    const tempPassword = password;
    const mailOptions = {
      from: "barkcodecompawnion@gmail.com",
      to: email,
      subject: "Admin Registration Successful",
      html: `
        <h1>Welcome to Compawnion!</h1>
        <p>Dear ${name},</p>
        <p>Your account has been successfully registered as an admin. Here are your details:</p>
        <ul>
          <li><strong>Admin ID:</strong> ${adminId}</li>
          <li><strong>Name:</strong> ${name}</li>
          <li><strong>Username:</strong> ${username}</li>
          <li><strong>Email:</strong> ${email}</li>
          <li><strong>Initial Password:</strong> ${tempPassword}</li>
        </ul>
        <p>Please keep your password safe.</p>
        <p>If you did not create this account, please contact support immediately.</p>
        <p>We look forward to working with you!</p>
      `,
    };

    await transporter.sendMail(mailOptions);
  }

  async function sendLoginNotificationEmail(email, name, loginTime) {
    const mailOptions = {
      from: "barkcodecompawnion@gmail.com",
      to: email,
      subject: "Login Notification",
      html: `
      <h1>Login Successful</h1>
      <p>Dear ${name},</p>
      <p>You have successfully logged in to your admin account.</p>
      <p><strong>Login Time:</strong> ${loginTime}</p>
      <p>If this was not you, please contact support immediately.</p>
    `,
    };

    await transporter.sendMail(mailOptions);
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // Create Admin

  Admins.post("/register", async (req, res) => {
    const {
      Name,
      Picture: Image,
      Username,
      Password,
      Email,
      Mobilenumber,
      Branches,
    } = req.body;

    // Check if all required fields are provided
    if (
      !Name ||
      !Username ||
      !Password ||
      !Email ||
      !Mobilenumber ||
      !Branches
    ) {
      return res.status(400).json({ message: "All fields are required." });
    }

    // Translate Image file into blob
    let Picture = null;
    if (Image) {
      try {
        const type = Image.match(
          /data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*,.*/
        )[1];
        const data = Image.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(data, "base64");

        const file = storage.file(`Admins/${Username}.${type.split("/")[1]}`);
        await file.save(buffer, { contentType: type });
        Picture = `https://compawnion-backend.onrender.com/media/Admins/${Username}.${type.split("/")[1]
          }`;
      } catch (error) {
        console.error("Error uploading image:", error);
        return res.status(500).json({ message: "Failed to upload image." });
      }
    }

    // Check for duplicate username and email
    try {
      const existingUserSnapshot = await db
        .collection("Admins")
        .where("aStaffInfo.Username", "==", Username)
        .get();

      if (!existingUserSnapshot.empty) {
        console.log(`Duplicate username detected: ${Username}`);
        return res.status(400).json({ message: "Username already exists." });
      }

      const existingEmailSnapshot = await db
        .collection("Admins")
        .where("aStaffInfo.Email", "==", Email)
        .get();

      if (!existingEmailSnapshot.empty) {
        console.log(`Duplicate email detected: ${Email}`);
        return res.status(400).json({ message: "Email already in use." });
      }

      // Call to get the next Admin ID
      const AdminId = await getNextAdminId();
      const formattedAdminId = AdminId.toString().padStart(3, "0");

      // Send the registration email with the plain password first
      await sendAdminRegistrationEmail(
        Email,
        formattedAdminId,
        Username,
        Name,
        Password
      );

      // after sending the registration email to the user the password will be hashed
      const hashedPassword = await bcrypt.hash(Password, 10);
      const token = jwt.sign({ Username }, secretKey, { expiresIn: "1h" });

      await db
        .collection("Admins")
        .doc(formattedAdminId)
        .set({
          aStaffInfo: {
            Name,
            Picture,
            Username,
            Password: hashedPassword,
            Email,
            Mobilenumber,
            Branches,
          },
          token,
          LastLogin: null, // creates a timestamp when a user logs in
          LastLogout: null, // creates a timestamp when a user logs out
        });

      res.status(201).json({
        message: `Staff registered successfully with ID: ${formattedAdminId}`,
        token,
      });
    } catch (error) {
      console.error("Error registering staff:", error);
      res.status(500).json({ message: "Failed to register staff.", error });
    }
  });


  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // Login Admin

  Admins.post("/login", async (req, res) => {
    const { Username, Password, Email } = req.body;
    console.log(`Login attempt for username: ${Username} or email: ${Email}`); // Log the username or email


    //function to retrieve the username/email from the database
    try {
      let userSnapshot = await db
        .collection("Admins")
        .where("aStaffInfo.Username", "==", Username)
        .get();

      if (userSnapshot.empty) {
        console.log("No user found with this username. Trying with email.");
        userSnapshot = await db
          .collection("Admins")
          .where("aStaffInfo.Email", "==", Email)
          .get();
      }

      // Check if user was found by either username or email
      if (userSnapshot.empty) {
        console.log("No user found with this username or email.");
        return res.status(404).json({ message: "User not found." });
      }

      // Get the user's data
      const userData = userSnapshot.docs[0].data();

      // Checking the password if its correct
      const isMatch = await bcrypt.compare(
        Password,
        userData.aStaffInfo.Password
      );

      if (!isMatch) {
        console.log("Invalid credentials.");
        return res.status(401).json({ message: "Invalid credentials." });
      }

      // Updates the user's last login timestamp
      const loginTimestamp = new Date().toISOString();
      const token = jwt.sign(
        { Username: userData.aStaffInfo.Username },
        secretKey,
        { expiresIn: "1h" }
      );

      await userSnapshot.docs[0].ref.update({
        LastLogin: loginTimestamp,
        token,
      });

      // Sending a login notification email
      await sendLoginNotificationEmail(
        userData.aStaffInfo.Email,
        userData.aStaffInfo.Name,
        loginTimestamp
      );

      // Return the token for the logged-in user
      res.json({ token });
    } catch (error) {
      console.error("Error logging in:", error);
      res.status(500).json({ message: "Failed to log in.", error });
    }
  });

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // Logout Admin

  Admins.post("/logout", async (req, res) => {
    const { Username, Email } = req.body;

    if (!Username && !Email) {
      return res
        .status(400)
        .json({ message: "Username or Email is required." });
    }

    //function to retrieve the username/email from the database
    try {
      let userSnapshot = await db
        .collection("Admins")
        .where("aStaffInfo.Username", "==", Username)
        .get();

      if (userSnapshot.empty) {
        console.log("No user found with this username. Trying with email.");
        userSnapshot = await db
          .collection("Admins")
          .where("aStaffInfo.Email", "==", Email)
          .get();
      }

      // Check if user was found by either username or email
      if (userSnapshot.empty) {
        return res.status(404).json({ message: "User not found." });
      }

      // Set the LastLogout timestamp
      await userSnapshot.docs[0].ref.update({
        LastLogout: new Date().toISOString(), // Record the time of logout
      });

      res.json({ message: "Logout successful." });
    } catch (error) {
      console.error("Error logging out:", error);
      res.status(500).json({ message: "Failed to log out.", error });
    }
  });

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // Read All Admins

  Admins.get("/", async (req, res) => {
    try {
      const snapshot = await db.collection("Admins").get();
      const users = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      res.json(users);
    } catch (error) {
      res.status(500).json({ message: "Error retrieving Admins", error });
    }
  });

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // Get My Profile

  Admins.get("/me", async (req, res) => {
    const { authorization } = req.headers;
    console.log(req.headers);

    if (!authorization) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const token = authorization.split(" ")[1];
    console.log(token);

    try {
      const decoded = jwt.verify(token, secretKey);
      const userSnapshot = await db
        .collection("Admins")
        .where("aStaffInfo.Username", "==", decoded.Username)
        .get();

      if (userSnapshot.empty) {
        return res.status(404).json({ message: "User not found." });
      }

      const userData = userSnapshot.docs[0].data();
      res.json({ id: userSnapshot.docs[0].id, ...userData });
    } catch (error) {
      res.status(500).json({ message: "Error retrieving profile", error });
    }
  });

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  // Read a specific Admin by ID
  Admins.get("/:id", async (req, res) => {
    try {
      const userId = req.params.id;
      const userRef = db.collection("Admins").doc(userId);
      const doc = await userRef.get();

      if (!doc.exists) {
        return res.status(404).json({ message: "Admin not found" });
      }
      res.json({ id: doc.id, ...doc.data() });
    } catch (error) {
      res.status(500).json({ message: "Error retrieving Admins", error });
    }
  });

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // Update Admin

  Admins.put("/:id", async (req, res) => {
    try {
      const userId = req.params.id;
      const userRef = db.collection("Admins").doc(userId);
      const updatedUser = req.body;

      // Fetch existing admin details
      const userDoc = await userRef.get();
      if (!userDoc.exists) {
        return res.status(404).json({ message: "Admin not found" });
      }

      const oldEmail = userDoc.data().aStaffInfo.Email;
      const newEmail = updatedUser.aStaffInfo.Email; 

      // Check if the new email is already taken by another user
      if (newEmail && newEmail !== oldEmail) {
        const emailCheckSnapshot = await db
          .collection("Admins")
          .where("aStaffInfo.Email", "==", newEmail)
          .get();

        if (!emailCheckSnapshot.empty) {
          return res.status(400).json({ message: "Email already exists." });
        }
      }

      // Handle profile picture update if provided
      const { Picture: Image } = req.body;
      let Picture = null;
      if (Image) {
        try {
          const type = Image.match(
            /data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*,.*/
          )[1];
          const data = Image.replace(/^data:image\/\w+;base64,/, "");
          const buffer = Buffer.from(data, "base64");

          const file = storage.file(`Admins/${userId}.${type.split("/")[1]}`);
          await file.save(buffer, { contentType: type });
          Picture = `https://compawnion-backend.onrender.com/media/Admins/${userId}.${type.split("/")[1]
            }`;
        } catch (error) {
          console.error("Error uploading image:", error);
          return res.status(500).json({ message: "Failed to upload image." });
        }
      }

      updatedUser.aStaffInfo.Picture =
        Picture || userDoc.data().aStaffInfo.Picture;

      // Update admin details in database
      await userRef.update(updatedUser);

      // If the email is changed, send a notification
      if (oldEmail !== newEmail) {
        await sendEmailUpdateNotification(
          oldEmail,
          newEmail,
          userId,
          updatedUser.aStaffInfo.Name
        );
      }

      res.json({ message: "Admin updated successfully" });
    } catch (error) {
      console.error("Error updating Admin:", error);
      res.status(500).json({ message: "Error updating Admin", error });
    }
  });

  // Function to send email update notifications
  async function sendEmailUpdateNotification(
    oldEmail,
    newEmail,
    adminId,
    name
  ) {
    const mailOptions = {
      from: "barkcodecompawnion@gmail.com",
      to: [oldEmail, newEmail],
      subject: "Email Address Updated",
      html: `
        <h1>Email Address Updated</h1>
        <p>Dear ${name},</p>
        <p>Your email address associated with Admin ID <strong>${adminId}</strong> has been updated.</p>
        <ul>
          <li><strong>Old Email:</strong> ${oldEmail}</li>
          <li><strong>New Email:</strong> ${newEmail}</li>
        </ul>
        <p>If you did not make this change, please contact support immediately.</p>
        <p>Thank you for keeping your information up-to-date!</p>
      `,
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log("Email update notification sent successfully.");
    } catch (error) {
      console.error("Error sending email update notification:", error);
      throw error;
    }
  }



  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // Delete Admin

  Admins.delete("/:id", async (req, res) => {
    try {
      const { superadminPassword } = req.body; // It requires superadmin password
      const userId = req.params.id;
      const userRef = db.collection("Admins").doc(userId);

      // Fetch the superadmin document from database
      const superadminDoc = await db
        .collection("superadmin")
        .doc("onlysuperadmin")
        .get();

      if (!superadminDoc.exists) {
        return res.status(404).json({ message: "Superadmin not found." });
      }

      const { superadminpassword } = superadminDoc.data();

      // check if the password is correct
      if (superadminPassword !== superadminpassword) {
        return res
          .status(401)
          .json({ message: "Invalid superadmin password." });
      }

      // Delete the user admin
      await userRef.delete();
      res.json({ message: "Admin deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Error deleting Admin", error });
    }
  });

  return Admins;
};
