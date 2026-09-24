import { expect } from 'chai';
import { describe, it, before, after } from 'mocha';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Cx } from '../cx/cx';
import { createCx } from './setup/BaseIntegrationTest';
import { validateRequiredEnv } from './setup/Environment';

// A Dockerfile using an old base image known to have vulnerabilities
const DOCKERFILE_WITH_VULNERABLE_IMAGE = `
FROM ubuntu:14.04
RUN apt-get update && apt-get install -y curl
COPY . /app
CMD ["node", "/app/index.js"]
`;

// A Dockerfile using a more recent, minimal image
const DOCKERFILE_CLEAN = `
FROM alpine:3.19
RUN apk add --no-cache curl
COPY . /app
CMD ["sh", "/app/run.sh"]
`;

describe('Integration: Containers Real-Time Scanner', function () {
    this.timeout(120000);

    let cx: Cx;
    let tmpDir: string;
    let vulnerableDockerfile: string;
    let cleanDockerfile: string;

    before(function () {
        validateRequiredEnv();
        cx = createCx();

        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cx-integration-containers-'));
        vulnerableDockerfile = path.join(tmpDir, 'Dockerfile.vulnerable');
        cleanDockerfile      = path.join(tmpDir, 'Dockerfile.clean');

        fs.writeFileSync(vulnerableDockerfile, DOCKERFILE_WITH_VULNERABLE_IMAGE);
        fs.writeFileSync(cleanDockerfile, DOCKERFILE_CLEAN);
    });

    after(function () {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('should run Containers scan on a Dockerfile and return results', async function () {
        const result = await cx.scanContainers(vulnerableDockerfile, '');
        expect(result).to.not.be.undefined;
        expect(result).to.be.an('array');
        expect(result.length).to.be.greaterThan(0, 'Expected Containers scan to detect vulnerabilities in ubuntu:14.04 base image');
    });

    it('should return results for a Dockerfile with a newer base image', async function () {
        const result = await cx.scanContainers(cleanDockerfile, '');
        expect(result).to.not.be.undefined;
        expect(result).to.be.an('array');
    });
});
