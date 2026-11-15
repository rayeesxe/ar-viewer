// Adds the Siri / App Shortcuts Swift file to the iOS app target during prebuild.
const fs = require('fs');
const path = require('path');
const { withDangerousMod, withXcodeProject, IOSConfig } = require('expo/config-plugins');

const FILE = 'MyViewIntents.swift';

module.exports = function withAppIntents(config) {
  config = withDangerousMod(config, [
    'ios',
    async (c) => {
      const name = IOSConfig.XcodeUtils.getProjectName(c.modRequest.projectRoot);
      const dest = path.join(c.modRequest.platformProjectRoot, name, FILE);
      fs.copyFileSync(path.join(c.modRequest.projectRoot, 'ios-native', FILE), dest);
      return c;
    },
  ]);
  config = withXcodeProject(config, (c) => {
    const name = IOSConfig.XcodeUtils.getProjectName(c.modRequest.projectRoot);
    const project = c.modResults;
    const already = Object.values(project.pbxFileReferenceSection()).some(
      (f) => f && f.path && String(f.path).replace(/"/g, '').endsWith(FILE)
    );
    if (!already) {
      IOSConfig.XcodeUtils.addBuildSourceFileToGroup({
        filepath: `${name}/${FILE}`,
        groupName: name,
        project,
      });
    }
    return c;
  });
  return config;
};
