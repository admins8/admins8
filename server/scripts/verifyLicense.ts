import path from 'path';
import { verifyLicense } from '../src/services/licenseService';

const result = verifyLicense({
  licensePath: path.resolve(process.cwd(), 'license/license.lic'),
  publicKeyPath: path.resolve(process.cwd(), 'license/public.pem'),
});
console.log(JSON.stringify(result, null, 2));
process.exit(result.valid ? 0 : 1);
