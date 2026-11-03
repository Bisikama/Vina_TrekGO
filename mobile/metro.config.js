const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Gói bản đồ có sẵn: assets/maps/offline-map.db
if (!config.resolver.assetExts.includes('db')) {
  config.resolver.assetExts.push('db');
}

module.exports = config;
