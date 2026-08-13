import { expect } from 'chai';
import { describe, it, before, after } from 'mocha';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Cx } from '../cx/cx';
import { createCx } from './setup/BaseIntegrationTest';
import { validateRequiredEnv } from './setup/Environment';

// A Terraform file with a known misconfiguration (public S3 bucket)
const VULNERABLE_TERRAFORM = `
resource "aws_s3_bucket" "example" {
  bucket = "my-tf-test-bucket"
  acl    = "public-read"
}
`;

// A YAML CloudFormation template with a wide-open security group
const VULNERABLE_YAML = `
AWSTemplateFormatVersion: '2010-09-09'
Resources:
  OpenSecurityGroup:
    Type: AWS::EC2::SecurityGroup
    Properties:
      GroupDescription: Open to the world
      SecurityGroupIngress:
        - IpProtocol: -1
          CidrIp: 0.0.0.0/0
`;

// A clean Terraform file with no obvious misconfigurations
const CLEAN_TERRAFORM = `
resource "aws_s3_bucket" "private_bucket" {
  bucket = "my-private-bucket"
  acl    = "private"
}

resource "aws_s3_bucket_public_access_block" "example" {
  bucket                  = aws_s3_bucket.private_bucket.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
`;

// containersManagementTool hint (docker/podman); "docker" matches the extension's own default setting.
const CONTAINERS_MANAGEMENT_TOOL = 'docker';

describe('Integration: IAC Real-Time Scanner', function () {
    this.timeout(120000);

    let cx: Cx;
    let tmpDir: string;
    let vulnerableTf: string;
    let vulnerableYaml: string;
    let cleanTf: string;

    before(function () {
        validateRequiredEnv();
        cx = createCx();

        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cx-integration-iac-'));
        vulnerableTf   = path.join(tmpDir, 'main.tf');
        vulnerableYaml = path.join(tmpDir, 'template.yaml');
        cleanTf        = path.join(tmpDir, 'secure.tf');

        fs.writeFileSync(vulnerableTf, VULNERABLE_TERRAFORM);
        fs.writeFileSync(vulnerableYaml, VULNERABLE_YAML);
        fs.writeFileSync(cleanTf, CLEAN_TERRAFORM);
    });

    after(function () {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('should run IAC scan on a Terraform file and return results', async function () {
        const result = await cx.iacScanResults(vulnerableTf, CONTAINERS_MANAGEMENT_TOOL, '');
        expect(result).to.not.be.undefined;
        expect(result).to.be.an('array');
        const flatFindings = (result ?? []).flat ? (result ?? []).flat(Infinity) : (result ?? []);
        expect(flatFindings.length).to.be.greaterThan(0, 'Expected IAC scan to detect misconfiguration in public S3 bucket');
    });

    it('should run IAC scan on a YAML file and return results', async function () {
        const result = await cx.iacScanResults(vulnerableYaml, CONTAINERS_MANAGEMENT_TOOL, '');
        expect(result).to.not.be.undefined;
        expect(result).to.be.an('array');
        const flatFindings = (result ?? []).flat ? (result ?? []).flat(Infinity) : (result ?? []);
        expect(flatFindings.length).to.be.greaterThan(0, 'Expected IAC scan to detect open security group in CloudFormation template');
    });

    it('should return empty findings for a clean IaC file', async function () {
        const result = await cx.iacScanResults(cleanTf, CONTAINERS_MANAGEMENT_TOOL, '');
        expect(result).to.not.be.undefined;
        const findings: any[] = result ?? [];
        const flatFindings = findings.flat ? findings.flat(Infinity) : findings;
        const highOrCritical = flatFindings.filter(
            (f: any) => ['HIGH', 'CRITICAL'].includes((f?.severity ?? '').toUpperCase())
        );
        expect(highOrCritical.length).to.equal(0, 'Expected no HIGH/CRITICAL findings in clean Terraform file');
    });
});
