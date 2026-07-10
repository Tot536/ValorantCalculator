const rankData = [
  { label: "Iron 1", value: 1 },
  { label: "Iron 2", value: 2 },
  { label: "Iron 3", value: 3 },
  { label: "Bronze 1", value: 4 },
  { label: "Bronze 2", value: 5 },
  { label: "Bronze 3", value: 6 },
  { label: "Silver 1", value: 7 },
  { label: "Silver 2", value: 8 },
  { label: "Silver 3", value: 9 },
  { label: "Gold 1", value: 10 },
  { label: "Gold 2", value: 11 },
  { label: "Gold 3", value: 12 },
  { label: "Platinum 1", value: 13 },
  { label: "Platinum 2", value: 14 },
  { label: "Platinum 3", value: 15 },
  { label: "Diamond 1", value: 16 },
  { label: "Diamond 2", value: 17 },
  { label: "Diamond 3", value: 18 },
  { label: "Ascendant 1", value: 19 },
  { label: "Ascendant 2", value: 20 },
  { label: "Ascendant 3", value: 21 },
  { label: "Immortal 1", value: 22 },
  { label: "Immortal 2", value: 23 },
  { label: "Immortal 3", value: 24 },
  { label: "Radiant", value: 25 },
];

const publicKeyJwk = {
  kty: "RSA",
  n: "uxor2gsHl9lZxvltC9hDPOIVunTfCIrB7DEzD0g0krme7svS1UwzeBepet0W0Fl7vErhxQLT2l5srSN6b6bycqgUgn18zpkRBS7GeBeTQF08ghUHB0PB64FwOYcB9dZ1vbJcLYOvxSEEnGbdwXniZDVAc_L6BcjDjfXmNbzdwYI40J3Nt9LfM73Jt2BtalOlrmGfC52oQrOwkw5qN6Yr_EAZkvCzv-Idg9cpiqb5-_1xZF3xxNThaFy7ZQ9o-iUfJzYhaxLAYRzU1vYtg9jxTmBy8_GRTIB-9uUrEFbE83UMhCfNFNEaa5dwflOp6puW18XTQs5NhfMOtD1PiMFcfQ",
  e: "AQAB",
  alg: "RSA-OAEP",
  ext: true,
  key_ops: ["encrypt"],
};

const selects = Array.from(document.querySelectorAll("select"));
const riotInputs = Array.from(document.querySelectorAll(".riot-input"));
const averageValue = document.getElementById("averageValue");
const averageRank = document.getElementById("averageRank");
const resetButton = document.getElementById("resetButton");
const downloadButton = document.getElementById("downloadButton");
const statusMessage = document.getElementById("statusMessage");
const teamNameInput = document.getElementById("teamName");

const placeholderOption = '<option value="">Select rank</option>';
const riotIdPattern = /^[A-Za-z0-9._ -]{3,16}#[A-Za-z0-9]{3,5}$/;

function populateSelects() {
  const options = rankData
    .map((rank) => `<option value="${rank.value}">${rank.label}</option>`)
    .join("");

  selects.forEach((select) => {
    select.innerHTML = placeholderOption + options;
  });
}

function getNearestRankLabel(average) {
  if (Number.isNaN(average)) {
    return "Select all ranks";
  }

  const roundedAverage = Math.round(average);
  const match = rankData.find((rank) => rank.value === roundedAverage);
  return match ? match.label : "Outside range";
}

function getAverageState() {
  const selectedValues = selects.map((select) => select.value);
  const allRanksSelected = selectedValues.every((value) => value !== "");

  if (!allRanksSelected) {
    return {
      ready: false,
      average: 0,
      averageLabel: "Select all ranks",
    };
  }

  const chosenRanks = selectedValues.map((value) => Number(value));
  const total = chosenRanks.reduce((sum, current) => sum + current, 0);
  const average = total / 5;

  return {
    ready: true,
    average,
    averageLabel: getNearestRankLabel(average),
  };
}

function setStatus(message, tone = "") {
  statusMessage.textContent = message;
  statusMessage.className = tone ? `status-message ${tone}` : "status-message";
}

function getPlayerData() {
  return selects.map((select, index) => {
    const numericRank = Number(select.value);
    const rank = rankData.find((entry) => entry.value === numericRank);

    return {
      slot: index + 1,
      riotId: riotInputs[index].value.trim(),
      numericRank,
      rankLabel: rank ? rank.label : "",
    };
  });
}

function validateSubmission() {
  const teamName = teamNameInput.value.trim();
  if (!teamName) {
    return "Enter a team name.";
  }

  const averageState = getAverageState();
  if (!averageState.ready) {
    return "Select all five ranks before downloading.";
  }

  const players = getPlayerData();
  for (const player of players) {
    if (!player.riotId) {
      return `Enter a Riot ID for Player ${player.slot}.`;
    }

    if (!riotIdPattern.test(player.riotId)) {
      return `Player ${player.slot} needs a Riot ID like Example Name#EU1.`;
    }
  }

  return "";
}

function updateResults() {
  const averageState = getAverageState();
  averageValue.textContent = averageState.average.toFixed(1);
  averageRank.textContent = averageState.averageLabel;

  const submissionError = validateSubmission();
  downloadButton.disabled = submissionError !== "";

  if (submissionError) {
    setStatus(submissionError);
    return;
  }

  setStatus("Ready to download an encrypted submission file.");
}

function bufferToBase64(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  let binary = "";

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return window.btoa(binary);
}

function sanitizeFileSegment(value, fallback) {
  const cleaned = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return cleaned || fallback;
}

function concatUint8Arrays(...arrays) {
  const totalLength = arrays.reduce((sum, current) => sum + current.length, 0);
  const combined = new Uint8Array(totalLength);
  let offset = 0;

  arrays.forEach((array) => {
    combined.set(array, offset);
    offset += array.length;
  });

  return combined;
}

async function buildKeyId(jwk) {
  const source = `${jwk.n}.${jwk.e}`;
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(source)
  );
  const bytes = Array.from(new Uint8Array(digest));
  return bytes
    .slice(0, 8)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

async function buildEncryptedSubmission() {
  const averageState = getAverageState();
  const players = getPlayerData();
  const keyId = await buildKeyId(publicKeyJwk);
  const sortedPlayers = [...players].sort((left, right) => {
    if (right.numericRank !== left.numericRank) {
      return right.numericRank - left.numericRank;
    }

    return left.riotId.localeCompare(right.riotId);
  });

  const submission = {
    format: "valorant-rank-submission",
    version: 1,
    keyId,
    submissionId: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    teamName: teamNameInput.value.trim(),
    averageNumber: Number(averageState.average.toFixed(1)),
    averageRank: averageState.averageLabel,
    players: sortedPlayers,
  };

  const encoder = new TextEncoder();
  const publicKey = await crypto.subtle.importKey(
    "jwk",
    publicKeyJwk,
    {
      name: "RSA-OAEP",
      hash: "SHA-1",
    },
    false,
    ["encrypt"]
  );

  const symmetricMaterial = crypto.getRandomValues(new Uint8Array(64));
  const encryptionKeyBytes = symmetricMaterial.slice(0, 32);
  const macKeyBytes = symmetricMaterial.slice(32);
  const encryptionKey = await crypto.subtle.importKey(
    "raw",
    encryptionKeyBytes,
    {
      name: "AES-CBC",
    },
    false,
    ["encrypt"]
  );
  const macKey = await crypto.subtle.importKey(
    "raw",
    macKeyBytes,
    {
      name: "HMAC",
      hash: "SHA-256",
    },
    false,
    ["sign"]
  );

  const iv = crypto.getRandomValues(new Uint8Array(16));
  const encryptedKey = await crypto.subtle.encrypt(
    {
      name: "RSA-OAEP",
    },
    publicKey,
    symmetricMaterial
  );
  const encryptedPayload = await crypto.subtle.encrypt(
    {
      name: "AES-CBC",
      iv,
    },
    encryptionKey,
    encoder.encode(JSON.stringify(submission))
  );
  const payloadBytes = new Uint8Array(encryptedPayload);
  const macBytes = await crypto.subtle.sign(
    "HMAC",
    macKey,
    concatUint8Arrays(iv, payloadBytes)
  );

  return {
    format: submission.format,
    version: submission.version,
    keyId,
    submissionId: submission.submissionId,
    createdAt: submission.createdAt,
    algorithm: {
      content: "AES-CBC-256",
      integrity: "HMAC-SHA-256",
      keyWrap: "RSA-OAEP-SHA1",
    },
    encryptedKey: bufferToBase64(encryptedKey),
    iv: bufferToBase64(iv),
    payload: bufferToBase64(payloadBytes),
    mac: bufferToBase64(macBytes),
  };
}

function downloadSubmissionFile(contents) {
  const teamSegment = sanitizeFileSegment(teamNameInput.value.trim(), "team");
  const dateSegment = new Date().toISOString().slice(0, 10);
  const fileName = `valorant-submission-${teamSegment}-${dateSegment}.vrsub`;
  const blob = new Blob([JSON.stringify(contents, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  link.click();

  URL.revokeObjectURL(url);
}

async function handleDownload() {
  const validationError = validateSubmission();
  if (validationError) {
    setStatus(validationError, "is-error");
    return;
  }

  downloadButton.disabled = true;
  setStatus("Encrypting submission file...");

  try {
    const encryptedSubmission = await buildEncryptedSubmission();
    downloadSubmissionFile(encryptedSubmission);
    setStatus("Encrypted file downloaded. Send the .vrsub file to the organizer.", "is-success");
  } catch (error) {
    setStatus("Encryption failed on this device. Please refresh and try again.", "is-error");
  } finally {
    updateResults();
  }
}

selects.forEach((select) => {
  select.addEventListener("change", updateResults);
});

riotInputs.forEach((input) => {
  input.addEventListener("input", updateResults);
});

teamNameInput.addEventListener("input", updateResults);

resetButton.addEventListener("click", () => {
  teamNameInput.value = "";
  riotInputs.forEach((input) => {
    input.value = "";
  });
  selects.forEach((select) => {
    select.value = "";
  });
  updateResults();
});

downloadButton.addEventListener("click", handleDownload);

populateSelects();
updateResults();
