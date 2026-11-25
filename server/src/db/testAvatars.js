// Test profile images for the demo members.
// SVG files live in client/public/images/avatars and are served by Vite at /images/avatars/*.
export const TEST_AVATARS = {
  'IPF-1001': '/images/avatars/ipf-1001.svg', // Arjun Mehta
  'IPF-1002': '/images/avatars/ipf-1002.svg', // Priya Sharma
  'IPF-1003': '/images/avatars/ipf-1003.svg', // Karthik Reddy
  'IPF-1004': '/images/avatars/ipf-1004.svg', // Sneha Iyer
  'IPF-1005': '/images/avatars/ipf-1005.svg', // Vikram Verma
  'IPF-1006': '/images/avatars/ipf-1006.svg', // Divya Krishnan
  'IPF-1007': '/images/avatars/ipf-1007.svg', // Rohan Kulkarni
  'IPF-1008': '/images/avatars/ipf-1008.svg', // Ananya Menon
};

/** Gives demo members a test photo, without overwriting a photo someone uploaded. */
export async function applyTestAvatars(client) {
  let updated = 0;
  for (const [code, url] of Object.entries(TEST_AVATARS)) {
    const res = await client.query(
      `UPDATE member_profiles SET profile_image = $1
       WHERE member_code = $2 AND (profile_image IS NULL OR profile_image = '')`,
      [url, code]
    );
    updated += res.rowCount;
  }
  return updated;
}
