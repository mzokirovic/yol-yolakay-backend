function resolveActor(req) {
  const userId = req.user?.id || req.headers['x-user-id'] || null;
  const deviceId = req.headers['x-device-id'] || null;

  return {
    userId,
    deviceId,
    actorId: userId || deviceId,
    actorType: userId ? 'user' : (deviceId ? 'device' : 'none'),
  };
}

module.exports = { resolveActor };
