import { supabase } from '~/utils/auth';

export const getOrgMemebershipsForUser = async () => {
  const { data: memberships, error } = await supabase
    .from('members')
    .select(
      `
        *,
        organizations (
          id,
          name,
          created_at, 
          owner_id
        )
      `,
    )
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching memberships:', error);
    return null;
  }

  return memberships;
};

export const createOrganizationAndMembership = async () => {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

  if (sessionError) {
    throw sessionError;
  }

  const fullName = sessionData?.session?.user.user_metadata.fullName || sessionData?.session?.user?.email;
  const orgName = `${fullName}'s Organization`;

  const headers: any = {
    'Content-Type': 'application/json',
    'X-Orbiter-Token': sessionData.session?.access_token,
  };

  await fetch(`${import.meta.env.VITE_BASE_URL}/organizations`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      orgName,
    }),
  });
};
