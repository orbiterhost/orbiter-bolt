import { signOut, signUserIn, supabase } from '~/utils/auth';
import { useState, useEffect } from 'react';
import { Button } from '~/components/ui/Button';
import { Input } from '~/components/ui/Input';
import { motion } from 'framer-motion';
import type { Session } from '@supabase/supabase-js';
import { classNames } from '~/utils/classNames';
import { createOrganizationAndMembership, getOrgMemebershipsForUser } from '~/utils/db';

type Site = {
  id: string;
  created_at: string;
  organization_id: string;
  cid: string;
  domain: string;
  site_contract: string;
  updated_at: string;
  deployed_by: string | null;
  custom_domain?: string | null;
  domain_ownership_verified?: boolean | null;
  ssl_issued?: boolean | null;
};

type Organization = {
  id: string;
  created_at: string;
  name: string;
  owner_id: string;
};

type Membership = {
  id: string;
  created_at: string;
  role: string;
  user_id: string;
  organization_id: string;
  organizations: Organization;
  user?: {
    id: string;
    name: string;
    email: string;
    avatar: string;
  };
};

export default function OrbiterConnection({ className, ...props }: React.ComponentPropsWithoutRef<'form'>) {
  const [email, setEmail] = useState('');
  const [userSession, setSession] = useState<Session | null>(null);
  const [authCode, setAuthCode] = useState('');
  const [showAuthCode, setShowAuthCode] = useState(false);
  const [fetchingSites, setFetchingSites] = useState(false);
  const [isSitesExpanded, setIsSitesExpanded] = useState(false);
  const [sites, setSites] = useState<Site[]>([]);

  //   const [organizations, setOrganizations] = useState<Organization[]>([]);

  const [selectedOrganization, setSelectedOrganization] = useState<Organization | null>(null);

  //   const [members, setMembers] = useState<Membership[]>([]);

  //   const [invites, setInvites] = useState<Invite[]>([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);

      if (session) {
        loadSites();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const loadOrgs = async () => {
      console.log('loading...');

      const memberships = await getOrgMemebershipsForUser();

      if (memberships && memberships?.length === 0) {
        //  Create org and membership for user because this is a new user
        await createOrganizationAndMembership();

        const memberships = await getOrgMemebershipsForUser();

        // setOrganizations(memberships || []);

        const orgs = memberships && memberships.length > 0 ? memberships.map((m: Membership) => m.organizations) : null;

        const ownedOrg = (orgs && orgs.find((o: Organization) => o.owner_id === userSession?.user?.id)) || null;

        if (ownedOrg !== JSON.parse(JSON.stringify(selectedOrganization))) {
          setSelectedOrganization(ownedOrg);
        }
      } else if (memberships) {
        // setOrganizations(memberships);

        //  Check if there's already a selected org in local storage

        const localOrg = localStorage.getItem('orbiter-org');
        const orgs = memberships && memberships.length > 0 ? memberships.map((m: Membership) => m.organizations) : null;
        const foundLocalOrgMatch = orgs?.find((o: Organization) => o.id === localOrg);

        if (localOrg && foundLocalOrgMatch) {
          if (foundLocalOrgMatch !== JSON.parse(JSON.stringify(selectedOrganization))) {
            setSelectedOrganization(foundLocalOrgMatch);
          }
        } else {
          const ownedOrg = (orgs && orgs.find((o: Organization) => o.owner_id === userSession?.user?.id)) || null;

          if (ownedOrg !== JSON.parse(JSON.stringify(selectedOrganization))) {
            setSelectedOrganization(ownedOrg);
          }
        }
      }
    };

    if (userSession) {
      loadOrgs();
    }
  }, [userSession]);

  useEffect(() => {
    if (selectedOrganization && selectedOrganization.id !== userSession?.user?.user_metadata?.orgId) {
      updateUser(selectedOrganization);
    }

    if (selectedOrganization) {
      //   loadMembers();
    }
  }, [selectedOrganization]);

  const updateUser = async (org: Organization) => {
    const orgId = org.id;
    const { error } = await supabase.auth.updateUser({
      data: { orgId },
    });

    if (error) {
      console.log('Error updating user metadata: ', error);
    }
  };

  const loadSites = async () => {
    setFetchingSites(true);

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

      const headers: any = {
        'Content-Type': 'application/json',
        'X-Orbiter-Token': sessionData.session?.access_token,
      };

      const result = await fetch(`${import.meta.env.VITE_BASE_URL}/sites`, {
        method: 'GET',
        headers,
      });

      const data: any = await result.json();
      setSites(data.data || []);
      setFetchingSites(false);
    } catch (error) {
      console.log(error);
      setFetchingSites(false);
    }
  };

  const signIn = async (e: any, method: string) => {
    try {
      e.preventDefault();

      const url = window.location.href;
      const data = await signUserIn(method, url);
      console.log(data);
    } catch (error: any) {
      console.log(error);
      alert(error.message);
    }
  };

  const signInWithEmail = async (e: any) => {
    e.preventDefault();

    const { data, error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
      },
    });

    if (error) {
      console.log(error);
    }

    console.log(data);
    setShowAuthCode(true);
  };

  const verifyToken = async (e: any) => {
    e.preventDefault();

    try {
      const {
        data: { session },
        error,
      } = await supabase.auth.verifyOtp({
        email,
        token: authCode,
        type: 'email',
      });

      if (error) {
        console.log(error);
      }

      console.log(session);
    } catch (error) {
      console.log(error);
    }
  };

  const handleDisconnect = async () => {
    localStorage.removeItem('orbiter-org');
    signOut();
  };

  return (
    <motion.div
      className="bg-[#FFFFFF] dark:bg-[#0A0A0A] rounded-lg border border-[#E5E5E5] dark:border-[#1A1A1A]"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
    >
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/orbiter.svg" className="h-8" />
            <h3 className="text-base font-medium text-bolt-elements-textPrimary">Orbiter Connection</h3>
          </div>
        </div>
      </div>
      {userSession ? (
        <div className="px-6 pb-4">
          <button
            onClick={handleDisconnect}
            className={classNames(
              'px-4 py-2 rounded-lg text-sm flex items-center gap-2',
              'bg-red-500 text-white',
              'hover:bg-red-600',
            )}
          >
            <div className="i-ph:plug w-4 h-4" />
            Disconnect
          </button>
          {fetchingSites ? (
            <div className="flex items-center gap-2 mt-4 text-sm text-bolt-elements-textSecondary">
              <div className="i-ph:spinner-gap w-4 h-4 animate-spin" />
              Fetching sites...
            </div>
          ) : (
            <div className="mt-4">
              <button
                onClick={() => setIsSitesExpanded(!isSitesExpanded)}
                className="w-full bg-transparent text-left text-sm font-medium text-bolt-elements-textPrimary mb-3 flex items-center gap-2"
              >
                <div className="i-ph:buildings w-4 h-4" />
                Your Sites ({sites.length || 0})
                <div
                  className={classNames(
                    'i-ph:caret-down w-4 h-4 ml-auto transition-transform',
                    isSitesExpanded ? 'rotate-180' : '',
                  )}
                />
              </button>
              {isSitesExpanded && sites?.length ? (
                <div className="grid gap-3">
                  {sites.map((site: Site) => (
                    <a
                      key={site.id}
                      href={site.custom_domain ? site.custom_domain : site.domain}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block p-4 rounded-lg border border-[#E5E5E5] dark:border-[#1A1A1A] hover:border-[#00AD9F] dark:hover:border-[#00AD9F] transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h5 className="text-sm font-medium text-bolt-elements-textPrimary flex items-center gap-2">
                            <div className="i-ph:globe w-4 h-4 text-[#00AD9F]" />
                            {site.custom_domain ? site.custom_domain : site.domain}
                          </h5>
                          <div className="flex items-center gap-2 mt-2 text-xs text-bolt-elements-textSecondary">
                            {site.updated_at && (
                              <>
                                <span className="flex items-center gap-1">
                                  <div className="i-ph:clock w-3 h-3" />
                                  {new Date(site.updated_at).toLocaleDateString()}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              ) : isSitesExpanded ? (
                <div className="text-sm text-bolt-elements-textSecondary flex items-center gap-2">
                  <div className="i-ph:info w-4 h-4" />
                  No sites found in your Netlify account
                </div>
              ) : null}
            </div>
          )}
        </div>
      ) : (
        <form className={'flex flex-col gap-6 text-white' + className} {...props}>
          {showAuthCode ? (
            <div>
              <div className="flex flex-col items-center gap-2 text-center">
                <h1 className="text-2xl font-bold">Enter the one-time code</h1>
                <p className="text-balance text-sm text-muted-foreground">Code was emailed to you</p>
                <div className="grid gap-6">
                  <Input
                    placeholder="Authentication code"
                    type="text"
                    value={authCode}
                    onChange={(e) => setAuthCode(e.target.value)}
                  />
                  <div className="text-center">
                    <Button onClick={verifyToken}>Submit code</Button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex flex-col items-center gap-2 text-center text-white">
                <h1 className="text-2xl font-bold">Login to your account</h1>
                <p className="text-balance text-sm text-muted-foreground mb-2">Use Github, Google, or Email</p>
              </div>
              <div className="grid gap-6 text-white">
                <Button onClick={(e) => signIn(e, 'github')} variant="outline" className="w-1/2 m-auto">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-4 mr-2">
                    <path
                      d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"
                      fill="currentColor"
                    />
                  </svg>
                  Login with GitHub
                </Button>
                <Button onClick={(e) => signIn(e, 'google')} variant="outline" className="w-1/2 m-auto">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="32"
                    height="32"
                    viewBox="0 0 128 128"
                    className="w-4 mr-2"
                  >
                    <path
                      fill="#fff"
                      d="M44.59 4.21a63.28 63.28 0 0 0 4.33 120.9a67.6 67.6 0 0 0 32.36.35a57.13 57.13 0 0 0 25.9-13.46a57.44 57.44 0 0 0 16-26.26a74.3 74.3 0 0 0 1.61-33.58H65.27v24.69h34.47a29.72 29.72 0 0 1-12.66 19.52a36.2 36.2 0 0 1-13.93 5.5a41.3 41.3 0 0 1-15.1 0A37.2 37.2 0 0 1 44 95.74a39.3 39.3 0 0 1-14.5-19.42a38.3 38.3 0 0 1 0-24.63a39.25 39.25 0 0 1 9.18-14.91A37.17 37.17 0 0 1 76.13 27a34.3 34.3 0 0 1 13.64 8q5.83-5.8 11.64-11.63c2-2.09 4.18-4.08 6.15-6.22A61.2 61.2 0 0 0 87.2 4.59a64 64 0 0 0-42.61-.38"
                    />
                    <path
                      fill="#e33629"
                      d="M44.59 4.21a64 64 0 0 1 42.61.37a61.2 61.2 0 0 1 20.35 12.62c-2 2.14-4.11 4.14-6.15 6.22Q95.58 29.23 89.77 35a34.3 34.3 0 0 0-13.64-8a37.17 37.17 0 0 0-37.46 9.74a39.25 39.25 0 0 0-9.18 14.91L8.76 35.6A63.53 63.53 0 0 1 44.59 4.21"
                    />
                    <path
                      fill="#f8bd00"
                      d="M3.26 51.5a63 63 0 0 1 5.5-15.9l20.73 16.09a38.3 38.3 0 0 0 0 24.63q-10.36 8-20.73 16.08a63.33 63.33 0 0 1-5.5-40.9"
                    />
                    <path
                      fill="#587dbd"
                      d="M65.27 52.15h59.52a74.3 74.3 0 0 1-1.61 33.58a57.44 57.44 0 0 1-16 26.26c-6.69-5.22-13.41-10.4-20.1-15.62a29.72 29.72 0 0 0 12.66-19.54H65.27c-.01-8.22 0-16.45 0-24.68"
                    />
                    <path
                      fill="#319f43"
                      d="M8.75 92.4q10.37-8 20.73-16.08A39.3 39.3 0 0 0 44 95.74a37.2 37.2 0 0 0 14.08 6.08a41.3 41.3 0 0 0 15.1 0a36.2 36.2 0 0 0 13.93-5.5c6.69 5.22 13.41 10.4 20.1 15.62a57.13 57.13 0 0 1-25.9 13.47a67.6 67.6 0 0 1-32.36-.35a63 63 0 0 1-23-11.59A63.7 63.7 0 0 1 8.75 92.4"
                    />
                  </svg>
                  Login with Google
                </Button>
              </div>
              <div className="relative">
                <div className="relative flex justify-center text-sm/6 font-medium mt-4">
                  <span className="px-6 text-white">Or continue with</span>
                </div>
                <div className="mt-2 w-1/2 m-auto pb-4">
                  <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email address" />
                  <div className="text-center mt-4">
                    <Button className="bg-purple-500 hover:bg-white hover:text-black" onClick={signInWithEmail}>
                      Sign in/up
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </form>
      )}
    </motion.div>
  );
}
