const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure data directory exists
const dataDirectory = path.join(__dirname, 'data');
const csvFilePath = path.join(dataDirectory, 'submissions.csv');
fs.mkdirSync(dataDirectory, { recursive: true });

// Middleware
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function getClientIp(req) {
  const xForwardedFor = req.headers['x-forwarded-for'];
  if (typeof xForwardedFor === 'string') {
    return xForwardedFor.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || req.ip || '';
}

function csvEscape(value) {
  if (value == null) return '';
  const str = String(value);
  if (str.includes('"') || str.includes(',') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function ensureCsvHeaderExists(filePath) {
  if (!fs.existsSync(filePath)) {
    const header = [
      'timestamp_iso',
      'full_name',
      'email',
      'phone_number',
      'company_name',
      'client_ip'
    ].join(',') + '\n';
    fs.writeFileSync(filePath, header, { encoding: 'utf-8' });
  }
}

app.post('/submit', (req, res) => {
  try {
    const fullName = (req.body.fullName || '').toString().trim();
    const email = (req.body.email || '').toString().trim();
    const phoneNumber = (req.body.phoneNumber || '').toString().trim();
    const companyName = (req.body.companyName || '').toString().trim();

    // Basic sanity limits to avoid absurd payloads
    const tooLong = [fullName, email, phoneNumber, companyName].some(v => v.length > 256);
    if (!fullName || !email || !phoneNumber || !companyName || tooLong) {
      // Even on validation failure, proceed to redirect to avoid blocking captive flow
      return res.redirect(302, 'http://hotspot.cedarviewng.local');
    }

    ensureCsvHeaderExists(csvFilePath);

    const timestampIso = new Date().toISOString();
    const clientIp = getClientIp(req);
    const row = [
      csvEscape(timestampIso),
      csvEscape(fullName),
      csvEscape(email),
      csvEscape(phoneNumber),
      csvEscape(companyName),
      csvEscape(clientIp)
    ].join(',') + '\n';

    fs.appendFile(csvFilePath, row, { encoding: 'utf-8' }, (err) => {
      if (err) {
        console.error('Failed to write submission:', err);
      }
      return res.redirect(302, 'http://hotspot.cedarviewng.local');
    });
  } catch (error) {
    console.error('Unexpected error handling submission:', error);
    return res.redirect(302, 'http://hotspot.cedarviewng.local');
  }
});

app.listen(PORT, () => {
  console.log(`Captive portal listening on http://localhost:${PORT}`);
});


