const { EOL } = require('os');
const fs = require('fs');
const { Plugin } = require('release-it');

module.exports = class LernaChangelogGeneratorPlugin extends Plugin {
  get lernaPath() {
    return require.resolve('lerna-changelog/bin/cli');
  }

  getChangelog(_from) {
    let { version, latestVersion } = this.config.getContext();
    let from = _from || `v${latestVersion}`;

    return this.exec(`${this.lernaPath} --next-version=v${version} --from=${from}`, {
      options: { write: false },
    });
  }

  async writeChangelog() {
    const { infile } = this.options;
    let { changelog } = this.config.getContext();

    let hasInfile = false;
    try {
      fs.accessSync(infile);
      hasInfile = true;
    } catch (err) {
      this.debug(err);
    }

    if (!hasInfile) {
      // figure out how to generate a full changelog with lerna-changelog
      let firstCommit = await this.exec(`git rev-list --max-parents=0 HEAD`);

      if (firstCommit) {
        changelog = await this.getChangeLog(firstCommit);
        this.debug({ changelog });
      } else {
        // do something when there is no tag? not sure what our options are...
      }
    }

    if (this.global.isDryRun) {
      this.log.log(`! Prepending ${infile} with release notes.`);
    } else {
      let currentFileData = hasInfile ? fs.readFileSync(infile, { encoding: 'utf8' }) : '';
      fs.writeFileSync(infile, changelog + EOL + EOL + currentFileData, { encoding: 'utf8' });
    }

    if (!hasInfile) {
      await this.exec(`git add ${infile}`);
    }
  }

  async beforeRelease() {
    const changelog = await this.getChangelog();
    this.debug({ changelog });
    this.config.setContext({ changelog });

    if (this.options.infile) {
      await this.writeChangelog();
    }
  }
};