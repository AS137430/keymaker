const lockScanner = require('./lib/lock_scanner');
const Session = require('./lib/offline_session');
const SecCommand = require('./lib/sec/sec_command');
const util = require('util');
const delay = require('./lib/delay');
const cmd = require('./lib/command_builder');
const sounds = require('./lib/mcu/sound_enum');
const environmentConfig = require('../environment.json');
const Environment = require('./lib/environment')
require('./lib/async_logging');

const environment = new Environment(environmentConfig);
function log(channel, data) {
  console.log(channel + ': ' + data.toString('hex'));
}

async function onSessionStart(session) {
    while(true) {
      await session.mcuWrite(cmd.playSound(sounds.byName['purr']).data);
      await delay(2500);
    }
}

lockScanner.on('lockFound', async lock => {
  console.log('Connected to', lock.id);
  var keychain = environment.createKeychainForLock(lock.id);
  if(!keychain) {
    console.log('No offline keys for lock.');
    return;
  }

  try {
    var session = new Session(lock, keychain);
    session.on('secWrite', d=>log('comp->sec', d));
    session.on('mcuWrite', d=>log('comp->mcu', d));
    session.on('secUpdate', d=>log('sec->comp', d));
    session.on('mcuUpdate', d=>log('mcu->comp', d));
    session.once('established', d=>onSessionStart(session));
    lock.on('error', d=>log('err', d));
    session.on('error', d=>log('err', d));
    await session.establish();
  } catch (e) {
    console.log(e);
  }
});

lockScanner.on('error', e => console.log(e));
lockScanner.start();
