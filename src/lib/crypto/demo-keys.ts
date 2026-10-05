/**
 * Pre-seeded private keys for demo peers (Alice, Bob, Clara)
 * In production, private keys are generated in the browser and stored in IndexedDB.
 */

export const DEMO_PREKEYS_PRIV: Record<string, string> = {
  'ID:ALIC8821':
    'MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQg8kH/mYdnyurgF/BrFXe5w23TwBIkM4JxT2Mw+EgW5syhRANCAATvO9hIPFfezUosQnQ0IcYQEt2kI4rI0Vep39YuiPzGGpvzqhl3O/SilbkFbKEKcsbkDBee6yEzjfTtpQHYocbB',
  'ID:BOBX4492':
    'MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgz2CPqXR0taTFbswtp+LcIrTr0GJ7DTiG46dcExs3G+qhRANCAAS2Agy9LklazAvq+XFCNW0ipig3eUNAeszGmY3aIzEOoG8m8+Aa+e1p2ENHyLWIxLzi5xrzxqjGrQfp+73jmlpz',
  'ID:CLAR3310':
    'MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQg0gbm9XYVe2aN5U/v7ITnE0dllWFMYVyyNaj1PHWolOqhRANCAASyEmO7yuyH9YjKpAuQgj/RWa0rLIcc037/rlG7UzmcCfZ0vjkYP5J5IBYM41ZUgrRUtqcAeeyCQ9F6XkDtBJLp',
};

export const DEMO_PREKEYS_PUB: Record<string, string> = {
  'ID:ALIC8821':
    'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE7zvYSDxX3s1KLEJ0NCHGEBLdpCOKyNFXqd/WLoj8xhqb86oZdzv0opW5BWyhCnLG5AwXnushM4307aUB2KHGwQ==',
  'ID:BOBX4492':
    'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEtgIMvS5JWswL6vlxQjVtIqYoN3lDQHrMxpmN2iMxDqBvJvPgGvntadhDR8i1iMS84uca88aoxq0H6fu945pacw==',
  'ID:CLAR3310':
    'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEshJju8rsh/WIyqQLkII/0VmtKyyHHNN+/65Ru1M5nAn2dL45GD+SeSAWDONWVIK0VLanAHnsgkPRel5A7QSS6Q==',
};
