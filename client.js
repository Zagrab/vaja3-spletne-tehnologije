const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3000/api/v1';

const api = axios.create({ baseURL: BASE_URL });

// Unique suffix so the client can run multiple times without conflicts
const RUN_ID = Date.now();

function log(step, method, url, status, data) {
  console.log(`\n[${ step }] ${ method } ${ url }`);
  console.log(`  Status: ${ status }`);
  console.log(`  Odgovor:`, JSON.stringify(data, null, 2).substring(0, 300));
}

async function run() {
  let tokenA, tokenB, refreshTokenA, refreshTokenB;
  let materialId, reviewId, reportId;

  const emailA = `prodajalec+${RUN_ID}@test.si`;
  const emailB = `kupec+${RUN_ID}@test.si`;

  console.log(`\nZagon testov (RUN_ID: ${RUN_ID})`);
  console.log(`  Uporabnik A: ${emailA}`);
  console.log(`  Uporabnik B: ${emailB}`);

  try {
    // ============================================================
    // 1. Register uporabnik A (prodajalec)
    // ============================================================
    let res = await api.post('/auth/register', {
      email: emailA,
      password: 'test1234',
      first_name: 'Ana',
      last_name: 'Prodajalec',
      university_id: 1
    });
    log('1', 'POST', '/auth/register', res.status, res.data);
    const userAId = res.data.id;

    // ============================================================
    // 2. OAuth token za uporabnika A (grant_type=password)
    // ============================================================
    res = await api.post('/oauth/token', {
      grant_type: 'password',
      username: emailA,
      password: 'test1234'
    });
    log('2', 'POST', '/oauth/token (password grant)', res.status, res.data);
    tokenA = res.data.access_token;
    refreshTokenA = res.data.refresh_token;

    const authA = { headers: { Authorization: `Bearer ${tokenA}` } };

    // ============================================================
    // 3. Profil uporabnika A
    // ============================================================
    res = await api.get('/user/profile', authA);
    log('3', 'GET', '/user/profile', res.status, res.data);

    // ============================================================
    // 4. Upload gradiva (s PDF datoteko)
    // ============================================================
    // Create a dummy PDF file for testing
    const dummyPdfPath = path.join(__dirname, 'uploads', 'test-gradivo.pdf');
    fs.writeFileSync(dummyPdfPath, '%PDF-1.4 Testna PDF datoteka za StudyHub demo');

    const form = new FormData();
    form.append('title', 'Testno gradivo - Linearna algebra');
    form.append('description', 'Zapiski za predmet Linearna algebra, 1. letnik');
    form.append('price', '3.99');
    form.append('subject_id', '1');
    form.append('file', fs.createReadStream(dummyPdfPath));

    res = await api.post('/materials/upload', form, {
      headers: { ...form.getHeaders(), Authorization: `Bearer ${tokenA}` }
    });
    log('4', 'POST', '/materials/upload', res.status, res.data);
    materialId = res.data.id;

    // ============================================================
    // 5. Seznam vseh gradiv
    // ============================================================
    res = await api.get('/materials');
    log('5', 'GET', '/materials', res.status, res.data);

    // ============================================================
    // 6. Podrobnosti gradiva
    // ============================================================
    res = await api.get(`/materials/${materialId}`);
    log('6', 'GET', `/materials/${materialId}`, res.status, res.data);

    // ============================================================
    // 7. Posodobitev gradiva (PUT)
    // ============================================================
    res = await api.put(`/materials/${materialId}`, {
      title: 'Testno gradivo - Linearna algebra (posodobljeno)',
      price: 4.99
    }, authA);
    log('7', 'PUT', `/materials/${materialId}`, res.status, res.data);

    // ============================================================
    // 8. Register uporabnik B (kupec)
    // ============================================================
    res = await api.post('/auth/register', {
      email: emailB,
      password: 'test5678',
      first_name: 'Bor',
      last_name: 'Kupec',
      university_id: 1
    });
    log('8', 'POST', '/auth/register', res.status, res.data);

    // ============================================================
    // 9. OAuth token za uporabnika B
    // ============================================================
    res = await api.post('/oauth/token', {
      grant_type: 'password',
      username: emailB,
      password: 'test5678'
    });
    log('9', 'POST', '/oauth/token (password grant)', res.status, res.data);
    tokenB = res.data.access_token;
    refreshTokenB = res.data.refresh_token;

    const authB = { headers: { Authorization: `Bearer ${tokenB}` } };

    // ============================================================
    // 10. Nakup gradiva
    // ============================================================
    res = await api.post('/payments/checkout', {
      material_id: materialId
    }, authB);
    log('10', 'POST', '/payments/checkout', res.status, res.data);

    // ============================================================
    // 11. Knjižnica kupljenih gradiv
    // ============================================================
    res = await api.get('/purchases/library', authB);
    log('11', 'GET', '/purchases/library', res.status, res.data);

    // ============================================================
    // 12. Prenos kupljene datoteke
    // ============================================================
    res = await api.get(`/purchases/download/${materialId}`, {
      ...authB,
      responseType: 'arraybuffer'
    });
    log('12', 'GET', `/purchases/download/${materialId}`, res.status, `[PDF datoteka, ${res.data.length} bajtov]`);

    // ============================================================
    // 13. Oddaja ocene
    // ============================================================
    res = await api.post('/reviews', {
      material_id: materialId,
      rating: 5,
      comment: 'Odlicno gradivo, zelo priporocam!'
    }, authB);
    log('13', 'POST', '/reviews', res.status, res.data);
    reviewId = res.data.id;

    // ============================================================
    // 14. Seznam ocen za gradivo
    // ============================================================
    res = await api.get(`/reviews/${materialId}`);
    log('14', 'GET', `/reviews/${materialId}`, res.status, res.data);

    // ============================================================
    // 15. Brisanje ocene (DELETE)
    // ============================================================
    res = await api.delete(`/reviews/${reviewId}`, authB);
    log('15', 'DELETE', `/reviews/${reviewId}`, res.status, res.data);

    // ============================================================
    // 16. Prijava gradiva (report)
    // ============================================================
    res = await api.post('/reports', {
      material_id: materialId,
      reason: 'Testna prijava - preverjanje delovanja'
    }, authB);
    log('16', 'POST', '/reports', res.status, res.data);
    reportId = res.data.id;

    // ============================================================
    // 17. Preverjanje sinhronizacije
    // ============================================================
    const sinceDate = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    res = await api.get(`/sync/check?since=${sinceDate}`, authA);
    log('17', 'GET', `/sync/check?since=...`, res.status, res.data);

    // ============================================================
    // 18. Registracija za push obvestila
    // ============================================================
    res = await api.post('/push/subscribe', {
      endpoint: 'https://fcm.googleapis.com/fcm/send/test-endpoint-123',
      keys: { p256dh: 'test-key', auth: 'test-auth' }
    }, authA);
    log('18', 'POST', '/push/subscribe', res.status, res.data);

    // ============================================================
    // 19. Odjava od push obvestil (DELETE)
    // ============================================================
    res = await api.delete('/push/unsubscribe', authA);
    log('19', 'DELETE', '/push/unsubscribe', res.status, res.data);

    // ============================================================
    // 20. Refresh token (pridobi nov access token)
    // ============================================================
    res = await api.post('/oauth/token', {
      grant_type: 'refresh_token',
      refresh_token: refreshTokenA
    });
    log('20', 'POST', '/oauth/token (refresh_token grant)', res.status, res.data);
    tokenA = res.data.access_token;
    const authANew = { headers: { Authorization: `Bearer ${tokenA}` } };

    // ============================================================
    // 21. Brisanje gradiva (DELETE) - z novim tokenom
    // ============================================================
    res = await api.delete(`/materials/${materialId}`, authANew);
    log('21', 'DELETE', `/materials/${materialId}`, res.status, res.data);

    // ============================================================
    // 22. Brisanje računa uporabnika B (DELETE)
    // ============================================================
    res = await api.delete('/user/account', authB);
    log('22', 'DELETE', '/user/account', res.status, res.data);

    console.log('\n========================================');
    console.log('Vsi testi uspešno zaključeni!');
    console.log('========================================\n');

  } catch (err) {
    console.error('\nNAPAKA:', err.response ? `${err.response.status} - ${JSON.stringify(err.response.data)}` : err.message);
    process.exit(1);
  }
}

run();
