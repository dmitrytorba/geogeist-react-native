function canSendPrompt({ user, llmKey } = {}) {
  return Boolean(user && llmKey);
}

function shouldBootstrap({ user, llmKey, hasBootstrapped, currentLocation } = {}) {
  return Boolean(user && llmKey && currentLocation && !hasBootstrapped);
}

module.exports = { canSendPrompt, shouldBootstrap };
