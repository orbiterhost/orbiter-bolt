import { supabase } from '~/utils/auth';
import { ORBITER_API_URL } from './config';

export const getUserSession = async (request: any) => {
  try {
    const token = request.headers.get('X-Orbiter-Key');

    if (!token) {
      return {
        isAuthenticated: false,
      };
    }

    const {
      data: { user },
    } = await supabase.auth.getUser(token);

    if (user && user.id) {
      return {
        isAuthenticated: true,
        user,
      };
    } else {
      return {
        isAuthenticated: false,
      };
    }
  } catch (error) {
    console.log(error);
    throw error;
  }
};

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

  await fetch(`${ORBITER_API_URL}/organizations`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      orgName,
    }),
  });
};
