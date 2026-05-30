const http = require('http');

async function runTests() {
  console.log('--- FB LEAD ADS WEBHOOK VERIFICATION TEST ---');

  // Test 1: GET webhook validation (handshake)
  const getUrl = 'http://localhost:5002/api/leads/facebook/webhook?hub.mode=subscribe&hub.verify_token=ecogrid_lead_ads_secret_verify_token_2026&hub.challenge=test_challenge_1234';
  
  try {
    const res = await new Promise((resolve, reject) => {
      http.get(getUrl, (response) => {
        let data = '';
        response.on('data', chunk => data += chunk);
        response.on('end', () => resolve({ statusCode: response.statusCode, body: data }));
      }).on('error', reject);
    });

    console.log('GET Handshake Response Code:', res.statusCode);
    console.log('GET Handshake Body (should be test_challenge_1234):', res.body);
    if (res.statusCode === 200 && res.body === 'test_challenge_1234') {
      console.log('✅ GET Handshake Verification Passed!');
    } else {
      console.error('❌ GET Handshake Verification Failed.');
    }
  } catch (err) {
    console.error('❌ GET Handshake Error:', err.message);
  }

  // Test 2: POST webhook lead event ingestion
  console.log('\n--- FB LEAD ADS WEBHOOK LEAD INGESTION TEST ---');
  
  const postData = JSON.stringify({
    object: 'page',
    entry: [
      {
        id: '123456789_mock_page_id',
        changes: [
          {
            field: 'leadgen',
            value: {
              leadgen_id: 'mock_lead_id_' + Date.now(),
              page_id: '123456789_mock_page_id'
            }
          }
        ]
      }
    ]
  });

  const options = {
    hostname: 'localhost',
    port: 5002,
    path: '/api/leads/facebook/webhook',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  try {
    const res = await new Promise((resolve, reject) => {
      const req = http.request(options, (response) => {
        let data = '';
        response.on('data', chunk => data += chunk);
        response.on('end', () => resolve({ statusCode: response.statusCode, body: data }));
      });
      req.on('error', reject);
      req.write(postData);
      req.end();
    });

    console.log('POST Webhook Response Code:', res.statusCode);
    console.log('POST Webhook Response Body:', res.body);
    if (res.statusCode === 200 && res.body === 'EVENT_RECEIVED') {
      console.log('✅ POST Webhook Event Received Successfully (will log warning/error if matching page ID is not in DB, which is expected for mock page ID)!');
    } else {
      console.error('❌ POST Webhook Event Failed.');
    }
  } catch (err) {
    console.error('❌ POST Webhook Error:', err.message);
  }
}

runTests();
