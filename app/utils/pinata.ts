import { PinataSDK } from 'pinata';
import { supabase } from '~/utils/auth';
import { GROUP_ID } from './config';

export const pinata = new PinataSDK({
  pinataJwt: '',
  pinataGateway: '',
});

export const getKey = async () => {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

  if (sessionError) {
    throw sessionError;
  }

  const headers: any = {
    'Content-Type': 'application/json',
    'X-Orbiter-Token': sessionData.session?.access_token,
  };

  const result = await fetch(`${process.env.VITE_BASE_URL}/keys/upload_key`, {
    method: 'POST',
    headers,
    body: JSON.stringify({}),
  });

  const keyData = await result.json();

  return keyData;
};

export const uploadSite = async (files: any) => {
  try {
    const keyData: any = await getKey();
    const JWT = keyData.data;

    const { data } = await supabase.auth.getSession();

    const user = data.session?.user;

    let upload;

    if (files.length > 1) {
      upload = await pinata.upload.public
        .fileArray(files)
        .key(JWT)
        .group(GROUP_ID!)
        .keyvalues({
          userId: user?.id || '',
        });
    } else {
      upload = await pinata.upload.public
        .file(files)
        .key(JWT)
        .group(GROUP_ID!)
        .keyvalues({
          userId: user?.id || '',
        });
    }

    return upload.cid;
  } catch (error) {
    console.log('Upload error: ', error);
    throw error;
  }
};
