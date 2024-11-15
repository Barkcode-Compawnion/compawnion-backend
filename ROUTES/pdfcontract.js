const express = require("express");
const pdfcontract = express.Router();
const PDFDocument = require("pdfkit");
const fs = require("fs"); // For saving PDF locally
const path = require("path");

/**
 * @param {import('firebase-admin/firestore').Firestore} db
 * @returns {express.Router}
 */
module.exports = function (db) {
  // Function to convert boolean to Yes/No
  function booleanToYesNo(value) {
    return value === true ? "Yes" : "No";
  }
  //
  pdfcontract.post("/generate-contract/:id", async (req, res) => {
    const { id } = req.params;
    const { signature } = req.body; // Capture the base64 signature image

    if (!id) {
      return res.status(400).json({ message: "Application ID is required" });
    }

    try {
      const appDoc = await db
        .collection("Applications")
        .doc("PENDING")
        .collection("Applications")
        .doc(id)
        .get();

      if (!appDoc.exists) {
        return res
          .status(404)
          .json({ message: "Application is already been APPROVED or Does NOT exist" });
      }

      const appData = appDoc.data();
      const { applicant, petId } = appData; // Change petData.id to petId here

      if (!petId) {
        return res
          .status(404)
          .json({ message: "Pet ID not found in application" });
      }

      const rescuedAnimalDoc = await db
        .collection("RescuedAnimals")
        .doc(petId) // Use petId directly
        .get();

      if (!rescuedAnimalDoc.exists) {
        return res
          .status(404)
          .json({ message: "Pet not found in RescuedAnimals" });
      }

      const rescuedAnimalData = rescuedAnimalDoc.data();
      const { personal, background } = rescuedAnimalData;

      if (!personal || !personal.name || !personal.breed) {
        return res
          .status(404)
          .json({ message: "Incomplete pet details in RescuedAnimals" });
      }

      const currentDate = new Date().toLocaleDateString();

      // Verify background data fields before using them
      const medicalHistory = background.medicalHistory || [];
      const vaccinationHistory = background.vaccination || [];

      const petDataText = `
        Pet Name: ${personal.name}
        Type: ${personal.type || "N/A"}
        Breed: ${personal.breed}
        Age: ${
          personal.age
            ? `${personal.age.year || 0} years ${
                personal.age.month || 0
              } months`
            : "N/A"
        }

        Rescue Details:
        - Rescue Date: ${background.rescueDate || "N/A"}
        - Size: ${background.size || "N/A"}
        - Weight: ${background.weight || "N/A"} kg
        - Rescue Story: ${background.rescueStory || "N/A"}
        
        Medical History:
        ${medicalHistory
          .map(
            (record) =>
              `- Procedure: ${record.procedure || "N/A"}, Date: ${
                record.date || "N/A"
              }, Notes: ${record.notes || "N/A"}`
          )
          .join("\n")}
        
        Vaccination History:
        ${vaccinationHistory
          .map(
            (vaccine) =>
              `- Vaccine: ${vaccine.name || "N/A"}, Date: ${
                vaccine.date || "N/A"
              }, Expiry: ${vaccine.expiry || "N/A"}`
          )
          .join("\n")}
      `;

      // Create a PDF document
      const pdfDoc = new PDFDocument();

      // Stream the PDF as a response
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="adoption-contract.pdf"'
      );
      pdfDoc.pipe(res);

      // Add content to PDF
      pdfDoc
        .fontSize(16)
        .text("Compawnion AMS Adoption Contract", { align: "center" })
        .moveDown();

      pdfDoc
        .fontSize(12)
        .text(
          `By signing this agreement, the Adopter agrees to the following terms and conditions regarding the adoption of an animal from the Adoption Agency.\n\n` +
            `We are placing the following described animal with you for adoption:\n\n` +
            `Animal Information:\n${petDataText}\n\n` +
            `TERM CONDITIONS AND AGREEMENT\n\n` +
            `I agree that the animal will not be sold, nor given away, or transferred to another individual or organization without prior written consent from the Adoption Agency. The Adopter will not use the animal for breeding purposes.\n\n` +
            `I agree if at any point I can no longer care for the animal, I agree to return the animal to the Adoption Agency. Under no circumstances will the animal be abandoned, surrendered to a shelter, or placed in a new home without notifying the Adoption Agency.\n\n` +
            `I acknowledge that adopting an animal involves inherent risks, including but not limited to injury, illness, or behavioral issues. The Adoption Agency cannot be held liable for any injury, damage, or loss caused by the adopted animal after the adoption has been finalized. I agree to assume full responsibility for the care and behavior of the adopted animal.\n\n` +
            `I must reside in a suitable location that allows for the proper care of the animal, must demonstrate the ability to provide a safe, loving, and appropriate environment for the adopted animal.\n\n` +
            `The adopter must be 18 years old and above, if not, should be accompanied by a guardian/older family member.\n\n` +
            `I agree to maintain proper identification (such as a collar and RFID tag) for the animal at all times.\n\n` +
            `In case the adopter damages the RFID tag, there will be a penalty of 1,500 for replacement.\n\n` +
            `The Adopter agrees to make a non-refundable adoption fee of 500 pesos. Your fee includes spay/neuter, RFID tag, and vaccines current to the age of the dog/puppy/cat/kitten. Any vaccines or medical care costs after the adoption are the financial responsibility of the Adopter.\n\n` +
            `The Adopter acknowledges that they have read, understood, and agreed to the terms and conditions of the animal adoption process as outlined above.\n\n`,
          { align: "left" }
        );

      pdfDoc
        .text(`Adopter’s Information:\n`, { underline: true })
        .text(
          `• Full Name: ${applicant.name.firstName} ${
            applicant.name.middleName || ""
          } ${applicant.name.lastName}\n`
        )
        .text(`• Phone Number: ${applicant.contact?.phoneNumber}\n`)
        .text(`• Email Address: ${applicant.contact?.email}\n\n`)
        .text(
          `Adopter’s Signature:\n\n\n\n• Signature: ___________________________\n• Date: ${currentDate}`
        );

      // Check if signature exists and is a valid base64 string
      if (signature && signature.startsWith("data:image")) {
        // Embed the signature as an image in the PDF
        const imgData = signature.split(";base64,")[1]; // Extract the base64 data
        const imgBuffer = Buffer.from(imgData, "base64");

        // Insert the signature image into the PDF, adjusting its size and position
        pdfDoc
          .image(imgBuffer, pdfDoc.x + 70, pdfDoc.y - 75, {
            width: 200,
            height: 80,
          }) // Adjust the position and size
          .moveDown();
      }

      // Finalize the PDF
      pdfDoc.end();
    } catch (error) {
      console.error("Error generating contract:", error.message);
      console.error("Stack Trace:", error.stack); // Logs the error stack trace
      res
        .status(500)
        .json({ message: "Failed to generate contract", error: error.message });
    }
  });

  pdfcontract.post("/appform/:id", async (req, res) => {
    const { id } = req.params;

    // Fetch the application details
    let appDoc = await db
      .collection("Applications")
      .doc("PENDING")
      .collection("Applications")
      .doc(id)
      .get();

    if (!appDoc.exists) {
      // If not found in PENDING, check APPROVED collection
      const appDocApproved = await db
        .collection("Applications")
        .doc("APPROVED")
        .collection("Applications")
        .doc(id)
        .get();

      if (!appDocApproved.exists) {
        return res.status(404).json({ message: "Application not found" });
      }
      appDoc = appDocApproved;
    }

    const appData = appDoc.data();
    const {
      applicant,
      petId,
      applicationType,
      termsAndCondission,
      paymentAgreement,
      dwelling,
      petCare,
    } = appData;

    if (!petId) {
      return res
        .status(404)
        .json({ message: "Pet ID not found in application" });
    }

    // Fetch pet details from RescuedAnimals
    let rescuedAnimalDoc = await db
      .collection("RescuedAnimals")
      .doc(petId)
      .get();

    if (!appDoc.exists) {
      // If not found in RescuedAnimals, check AdoptedAnimals collection
      const appDocApproved = await db
        .collection("AdoptedAnimals")
        .doc(appPetID)
        .get();

      if (!rescuedAnimalDoc.exists) {
        return res
          .status(404)
          .json({ message: "Pet not found in RescuedAnimals" });
      }
      appDoc = appDocApproved;
    }

    // Create a PDF document
    const doc = new PDFDocument();

    // Stream the PDF as a response
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="application_form.pdf"'
    );
    doc.pipe(res);

    // Add content to PDF
    doc
      .fontSize(16)
      .text("Compawnion AMS Application Form", { align: "center" })
      .moveDown();

    // Pet Information
    doc
      .fontSize(15)
      .text("Pet Information:", { underline: true })
      .moveDown(0.5);
    doc
      .fontSize(12)
      .text(`Pet ID: ${petId}`)
      .text(`Application Type: ${applicationType}`)
      .moveDown();

    // Applicant Information
    doc
      .fontSize(15)
      .text("Applicant Information:", { underline: true })
      .moveDown(0.5);
    doc
      .fontSize(12)
      .text(
        `Name: ${applicant.name.firstName} ${applicant.name.middleName || ""} ${
          applicant.name.lastName
        }`
      )
      .text(`Birthdate: ${applicant.birthdate}`)
      .text(
        `Address: ${applicant.address.street} ${applicant.address.lot} ${applicant.address.baranggay} ${applicant.address.cityOrMunicipality} ${applicant.address.province}, ${applicant.address.country}`
      )
      .text(`Occupation: ${applicant.occupation}`)
      .text(`Email: ${applicant.contact.email}`)
      .text(`Facebook: ${applicant.contact.facebook || ""}`)
      .text(`Phone Number: ${applicant.contact.phoneNumber}`)
      .moveDown();

    // Dwelling Information
    doc
      .fontSize(15)
      .text("Dwelling Information:", { underline: true })
      .moveDown(0.5);
    doc
      .fontSize(12)
      .text(`Type of Dwelling: ${dwelling.type}`)
      .text(`Ownership: ${dwelling.ownership}`)
      .text(`Number of House Members: ${dwelling.numberOfHouseMembers}`)
      .text(`Number of Pets in the Household: ${dwelling.numberOfPets}`)
      .text(`Pets Allowed in House: ${dwelling.petsAllowedInHouse}`)
      .text(`Planning to Move Out in 6 months: ${dwelling.planningToMoveOut}`)
      .moveDown();

    // Pet Care Information
    doc
      .fontSize(15)
      .text("Pet Care Information:", { underline: true })
      .moveDown(0.5);
    doc
      .fontSize(12)
      .text(`Experience as a Pet Owner: ${petCare.petOwnershipExperience}`)
      .text(`Animal Clinic Known: ${petCare.veterinarian}`)
      .moveDown();

    // Terms and Conditions
    doc
      .fontSize(15)
      .text("Terms and Conditions:", { underline: true })
      .moveDown(0.5);
    doc
      .fontSize(12)
      .text(
        `Agreed to Terms and Conditions: ${booleanToYesNo(
          appData.termsAndCondission
        )}`
      )
      .moveDown();

    // Payment Agreement
    doc
      .fontSize(15)
      .text("Payment Agreement:", { underline: true })
      .moveDown(0.5);
    doc
      .fontSize(12)
      .text(
        `Agreed to Payment Terms: ${booleanToYesNo(appData.paymentAgreement)}`
      )
      .moveDown();

    // Finalize PDF and send it as a response
    doc.end();
  });

  pdfcontract.post("/both/:id", async (req, res) => {
    const { id } = req.params;

    try {
      // Step 1: Fetch application data from PENDING or APPROVED collections
      let appDoc = await db
        .collection("Applications")
        .doc("PENDING")
        .collection("Applications")
        .doc(id)
        .get();

      if (!appDoc.exists) {
        appDoc = await db
          .collection("Applications")
          .doc("APPROVED")
          .collection("Applications")
          .doc(id)
          .get();

        if (!appDoc.exists) {
          return res.status(404).json({ message: "Application not found" });
        }
      }

      const appData = appDoc.data();
      const petId = appData.petId;

      if (!petId) {
        return res
          .status(404)
          .json({ message: "Pet ID not found in application" });
      }

      // Step 2: Fetch pet details from RescuedAnimals or AdoptedAnimals collections
      let petDoc = await db.collection("RescuedAnimals").doc(petId).get();

      if (!petDoc.exists) {
        const appPetID = appData.appPetID;
        const adoptedAnimalDoc = await db
          .collection("AdoptedAnimals")
          .doc(appPetID.toString())
          .get();

        if (!adoptedAnimalDoc.exists) {
          return res.status(404).json({
            message: "Pet not found in RescuedAnimals or AdoptedAnimals",
          });
        }

        petDoc = adoptedAnimalDoc.data();
      }

      // Unwrap pet data (adjusting for nested structure)
      const petData = petDoc.exists ? petDoc.data() : petDoc;
      const petDataUnwrapped = petData[petId] || petData; // Adjust if pet data is nested

      // Check if petData contains the expected structure
      if (
        !petDataUnwrapped ||
        !petDataUnwrapped.personal ||
        !petDataUnwrapped.background
      ) {
        return res.status(404).json({ message: "Incomplete pet data" });
      }

      // Step 3: Create a PDF document
      const doc = new PDFDocument();
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="application_form.pdf"'
      );
      doc.pipe(res);

      // Title
      doc
        .fontSize(16)
        .text("Compawnion AMS Application Form".toUpperCase(), {
          align: "center",
        })
        .moveDown();

      // APPLICATION TYPE
      doc
        .fontSize(15)
        .text("APPLICATION:".toUpperCase())
        .text("________________________________________________________")
        .moveDown();
      doc
        .fontSize(12)
        .text(`Application Type: ${appData.applicationType}`)
        .moveDown();

      // Pet Information
      doc
        .fontSize(15)
        .text("Pet Information:".toUpperCase())
        .text("________________________________________________________")
        .moveDown(0.5);
      doc
        .fontSize(12)
        .text(`Name: ${petDataUnwrapped.personal.name}`)
        .text(`Type: ${petDataUnwrapped.personal.type}`)
        .text(`Breed: ${petDataUnwrapped.personal.breed}`)
        .text(`Gender: ${petDataUnwrapped.personal.gender}`)
        .text(
          `Age: ${petDataUnwrapped.personal.age.year}yr ${petDataUnwrapped.personal.age.month}months`
        )
        .text(`Weight: ${petDataUnwrapped.background.weight}Kg`)
        .text(`Size: ${petDataUnwrapped.background.size}`)
        .text(`Rescued Date: ${petDataUnwrapped.background.rescueDate}`)
        .moveDown();

      // Applicant Information
      doc
        .fontSize(15)
        .text("Applicant Information:".toUpperCase())
        .text("________________________________________________________")
        .moveDown(0.5);
      doc
        .fontSize(12)
        .text(
          `Name: ${appData.applicant.name.firstName} ${
            appData.applicant.name.middleName || ""
          } ${appData.applicant.name.lastName}`
        )
        .text(`Birthdate: ${appData.applicant.birthdate}`)
        .text(
          `Address: ${appData.applicant.address.street} ${appData.applicant.address.lot} ${appData.applicant.address.baranggay}, ${appData.applicant.address.cityOrMunicipality}, ${appData.applicant.address.province}, ${appData.applicant.address.country}`
        )
        .text(`Occupation: ${appData.applicant.occupation}`)
        .text(`Email: ${appData.applicant.contact.email}`)
        .text(`Facebook: ${appData.applicant.contact.facebook || ""}`)
        .text(`Phone Number: ${appData.applicant.contact.phoneNumber}`)
        .moveDown();

      // Dwelling Information
      doc
        .fontSize(15)
        .text("Dwelling Information:".toUpperCase())
        .text("________________________________________________________")
        .moveDown(0.5);
      doc
        .fontSize(12)
        .text(`Type of Dwelling: ${appData.dwelling.type}`)
        .text(`Ownership: ${appData.dwelling.ownership}`)
        .text(
          `Number of House Members: ${appData.dwelling.numberOfHouseMembers}`
        )
        .text(
          `Number of Pets in the Household: ${appData.dwelling.numberOfPets}`
        )
        .text(`Pets Allowed in House: ${appData.dwelling.petsAllowedInHouse}`)
        .text(
          `Planning to Move Out in 6 months: ${appData.dwelling.planningToMoveOut}`
        )
        .moveDown(5);

      // Pet Care Information
      doc
        .fontSize(15)
        .text("Pet Care Information:".toUpperCase())
        .text("________________________________________________________")
        .moveDown(0.5);
      doc
        .fontSize(12)
        .text(
          `Experience as a Pet Owner: ${appData.petCare.petOwnershipExperience}`
        )
        .text(`Animal Clinic Known: ${appData.petCare.veterinarian}`)
        .moveDown();

      // Terms and Conditions
      doc
        .fontSize(15)
        .text("Terms and Conditions:".toUpperCase())
        .text("________________________________________________________")
        .moveDown(0.5);
      doc
        .fontSize(12)
        .text(
          `Agreed to Terms and Conditions: ${booleanToYesNo(
            appData.termsAndCondission
          )}`
        )
        .moveDown();

      // Payment Agreement
      doc
        .fontSize(15)
        .text("Payment Agreement:".toUpperCase())
        .text("________________________________________________________")
        .moveDown(0.5);
      doc
        .fontSize(12)
        .text(
          `Agreed to Payment Terms: ${booleanToYesNo(appData.paymentAgreement)}`
        )
        .moveDown();

      // Finalize PDF and send it as a response
      doc.end();
    } catch (error) {
      console.error("Error generating PDF:", error.message);
      res
        .status(500)
        .json({ message: "Failed to generate the PDF", error: error.message });
    }
  });

  pdfcontract.post("/petinfo/:id", async (req, res) => {
    const { id } = req.params;

    try {
      // Step 1: Fetch application data from PENDING or APPROVED collections
      let appDoc = await db
        .collection("Applications")
        .doc("PENDING")
        .collection("Applications")
        .doc(id)
        .get();

      if (!appDoc.exists) {
        appDoc = await db
          .collection("Applications")
          .doc("APPROVED")
          .collection("Applications")
          .doc(id)
          .get();

        if (!appDoc.exists) {
          return res.status(404).json({ message: "Application not found" });
        }
      }

      const appData = appDoc.data();
      const petId = appData.petId;

      if (!petId) {
        return res
          .status(404)
          .json({ message: "Pet ID not found in application" });
      }

      // Step 2: Fetch pet details from RescuedAnimals or AdoptedAnimals collections
      let petDoc = await db.collection("RescuedAnimals").doc(petId).get();

      if (!petDoc.exists) {
        const appPetID = appData.appPetID;
        const adoptedAnimalDoc = await db
          .collection("AdoptedAnimals")
          .doc(appPetID.toString()) // Use appPetID for AdoptedAnimals lookup
          .get();

        if (!adoptedAnimalDoc.exists) {
          return res.status(404).json({
            message: "Pet not found in RescuedAnimals or AdoptedAnimals",
          });
        }

        petDoc = adoptedAnimalDoc.data();
      }

      const petData = petDoc.exists ? petDoc.data() : petDoc; // Extract data from petDoc if it exists
      const petDataUnwrapped = petData[petId] || petData; // Adjust if pet data is nested

      // Check if petData contains the expected structure
      if (
        !petDataUnwrapped ||
        !petDataUnwrapped.personal ||
        !petDataUnwrapped.background
      ) {
        return res.status(404).json({ message: "Incomplete pet data" });
      }

      // Step 3: Create a PDF document
      const doc = new PDFDocument();
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="pet_info_form.pdf"'
      );
      doc.pipe(res);

      // Title
      doc
        .fontSize(16)
        .text("Compawnion AMS Pet Info Form".toUpperCase(), {
          align: "center",
        })
        .moveDown();

      // Pet Information
      doc
        .fontSize(15)
        .text("Pet Information:".toUpperCase())
        .text("________________________________________________________")
        .moveDown(0.5);
      doc
        .fontSize(12)
        .text(`Pet ID: ${petDataUnwrapped.petId}`)
        .text(`Name: ${petDataUnwrapped.personal.name}`)
        .text(`Type: ${petDataUnwrapped.personal.type}`)
        .text(`Breed: ${petDataUnwrapped.personal.breed}`)
        .text(`Gender: ${petDataUnwrapped.personal.gender}`)
        .text(
          `Age: ${petDataUnwrapped.personal.age.year}yr ${petDataUnwrapped.personal.age.month}months`
        )
        .text(`Weight: ${petDataUnwrapped.background.weight}Kg`)
        .text(`Size: ${petDataUnwrapped.background.size}`)
        .text(`Rescued Date: ${petDataUnwrapped.background.rescueDate}`)
        .moveDown();

      // Finalize PDF and send it as a response
      doc.end();
    } catch (error) {
      console.error(
        "Error fetching data for /petinfo/:id route:",
        error.message
      );
      res
        .status(500)
        .json({ message: "Failed to generate the PDF", error: error.message });
    }
  });

  return pdfcontract;
};
