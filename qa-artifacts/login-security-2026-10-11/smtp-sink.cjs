// Minimal implicit-TLS SMTP sink: accepts every message, appends it to mails.jsonl.
const tls = require('tls'); const fs = require('fs'); const path = require('path');
const out = path.join(__dirname, 'mails.jsonl');
tls.createServer({ key: fs.readFileSync(path.join(__dirname, 'key.pem')), cert: fs.readFileSync(path.join(__dirname, 'cert.pem')) }, (sock) => {
  let buf = '', inData = false, mail = { to: [], data: '' };
  const say = (l) => sock.write(l + '\r\n');
  say('220 sink');
  sock.on('data', (chunk) => {
    buf += chunk.toString('utf8');
    let i;
    while ((i = buf.indexOf('\r\n')) >= 0) {
      const line = buf.slice(0, i); buf = buf.slice(i + 2);
      if (inData) {
        if (line === '.') { inData = false; fs.appendFileSync(out, JSON.stringify({ ...mail, at: new Date().toISOString() }) + '\n'); mail = { to: [], data: '' }; say('250 ok'); }
        else mail.data += (line.startsWith('..') ? line.slice(1) : line) + '\n';
        continue;
      }
      const cmd = line.slice(0, 4).toUpperCase();
      if (cmd === 'EHLO') { say('250-sink'); say('250 AUTH PLAIN'); }
      else if (cmd === 'HELO') say('250 sink');
      else if (cmd === 'AUTH') say('235 ok');
      else if (cmd === 'MAIL') say('250 ok');
      else if (cmd === 'RCPT') { mail.to.push(line.replace(/^RCPT TO:\s*/i, '')); say('250 ok'); }
      else if (cmd === 'DATA') { inData = true; say('354 go'); }
      else if (cmd === 'QUIT') { say('221 bye'); sock.end(); }
      else say('250 ok');
    }
  });
  sock.on('error', () => {});
}).listen(2465, '127.0.0.1', () => console.log('smtp sink on 2465'));
