import * as tls from 'node:tls';

// Retain Node's trusted roots and include the operating system's trusted roots.
// This supports managed Windows networks without disabling TLS verification.
if (typeof tls.getCACertificates === 'function' && typeof tls.setDefaultCACertificates === 'function') {
    tls.setDefaultCACertificates([...new Set([...tls.getCACertificates('default'), ...tls.getCACertificates('system')])]);
}
