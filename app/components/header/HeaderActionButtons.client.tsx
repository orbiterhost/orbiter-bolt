import { useStore } from '@nanostores/react';
import { toast } from 'react-toastify';
import useViewport from '~/lib/hooks';
import { chatStore } from '~/lib/stores/chat';
import { workbenchStore } from '~/lib/stores/workbench';
import { webcontainer } from '~/lib/webcontainer';
import { classNames } from '~/utils/classNames';
import { path } from '~/utils/path';
import { useEffect, useRef, useState } from 'react';
import type { ActionCallbackData } from '~/lib/runtime/message-parser';
import { chatId } from '~/lib/persistence/useChatHistory';
import { streamingState } from '~/lib/stores/streaming';
import { NetlifyDeploymentLink } from '~/components/chat/NetlifyDeploymentLink.client';
import { getAccessToken, supabase } from '~/utils/auth';
import type { Session } from '@supabase/supabase-js';
import { uploadSite } from '~/utils/pinata';
import { ORBITER_API_URL } from '~/utils/config';

interface HeaderActionButtonsProps {}

export function HeaderActionButtons({}: HeaderActionButtonsProps) {
  const showWorkbench = useStore(workbenchStore.showWorkbench);
  const { showChat } = useStore(chatStore);
  const [activePreviewIndex] = useState(0);
  const previews = useStore(workbenchStore.previews);
  const activePreview = previews[activePreviewIndex];
  const [isDeploying, setIsDeploying] = useState(false);
  const isSmallViewport = useViewport(1024);
  const canHideChat = showWorkbench || !showChat;
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [userSession, setSession] = useState<Session | null>(null);
  const isStreaming = useStore(streamingState);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentChatId = useStore(chatId);

  const handleDeploy = async () => {
    if (!userSession) {
      toast.error('Please connect to Orbiter first in the settings tab!');
      return;
    }

    if (!currentChatId) {
      toast.error('No active chat found');
      return;
    }

    try {
      setIsDeploying(true);

      const accessToken = await getAccessToken();

      if (!currentChatId) {
        toast.error('No active chat found');
        return;
      }

      const artifact = workbenchStore.firstArtifact;

      if (!artifact) {
        throw new Error('No active project found');
      }

      // Build the project first
      const actionId = 'build-' + Date.now();
      const actionData: ActionCallbackData = {
        messageId: 'pinata build',
        artifactId: artifact.id,
        actionId,
        action: {
          type: 'build' as const,
          content: 'npm run build',
        },
      };

      // Add the action first
      artifact.runner.addAction(actionData);

      // Then run it
      await artifact.runner.runAction(actionData);

      if (!artifact.runner.buildOutput) {
        throw new Error('Build failed');
      }

      // Get the build files
      const container = await webcontainer;

      // Remove /home/project from buildPath if it exists
      const buildPath = artifact.runner.buildOutput.path.replace('/home/project', '');

      // Get all files recursively as binary data
      async function getAllFiles(dirPath: string): Promise<Map<string, File>> {
        const files = new Map<string, File>();
        const entries = await container.fs.readdir(dirPath, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dirPath, entry.name);

          if (entry.isFile()) {
            // Read as binary
            const contentBuffer = await container.fs.readFile(fullPath);

            // Convert to blob and then to File
            const blob = new Blob([contentBuffer]);

            // Remove /dist prefix from the path
            const deployPath = fullPath.replace(buildPath, '').replace(/^\//, '');

            // Create a File object from the blob
            const file = new File([blob], deployPath, {
              type: getContentType(deployPath),
            });

            files.set(deployPath, file);
          } else if (entry.isDirectory()) {
            const subFiles = await getAllFiles(fullPath);

            // Merge the maps
            subFiles.forEach((value, key) => {
              files.set(key, value);
            });
          }
        }

        return files;
      }

      // Determine content type based on file extension
      function getContentType(filePath: string): string {
        const extension = filePath.split('.').pop()?.toLowerCase();

        const mimeTypes: Record<string, string> = {
          html: 'text/html',
          css: 'text/css',
          js: 'application/javascript',
          json: 'application/json',
          png: 'image/png',
          jpg: 'image/jpeg',
          jpeg: 'image/jpeg',
          gif: 'image/gif',
          svg: 'image/svg+xml',
          ico: 'image/x-icon',
          txt: 'text/plain',
          md: 'text/markdown',
        };

        return extension && mimeTypes[extension] ? mimeTypes[extension] : 'application/octet-stream';
      }

      const fileMap = await getAllFiles(buildPath);

      // Create a meaningful project name
      const subdomain = `orbiter-${currentChatId}-${Date.now()}`;

      // Convert Map to array of Files for uploading
      const fileArray = Array.from(fileMap.values());

      if (fileArray.length === 0) {
        throw new Error('No files found in build output');
      }

      // Upload directory to Pinata using fileArray
      const cid = await uploadSite(fileArray);

      // Store the IPFS hash for future reference
      localStorage.setItem(`oribter-site-${currentChatId}`, cid);

      const orgId = userSession.user.user_metadata.orgId;

      const headers: any = {
        'Content-Type': 'application/json',
        'X-Orbiter-Token': accessToken,
      };

      const createSiteRequest = await fetch(`${ORBITER_API_URL}/sites`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          orgId,
          cid,
          subdomain,
        }),
      });

      if (!createSiteRequest.ok) {
        const data: any = await createSiteRequest.json();
        throw Error(data.message);
      }

      toast.success(
        <div>
          Deployed successfully!{' '}
          <a
            href={`https://${subdomain}.orbiter.website`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            View site
          </a>
        </div>,
      );
    } catch (error) {
      console.error('Deploy error:', error);
      toast.error(error instanceof Error ? error.message : 'Deployment failed');
    } finally {
      setIsDeploying(false);
    }
  };

  return (
    <div className="flex">
      <div className="relative" ref={dropdownRef}>
        <div className="flex border border-bolt-elements-borderColor rounded-md overflow-hidden mr-2 text-sm">
          <Button
            active
            disabled={isDeploying || !activePreview || isStreaming}
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="px-4 hover:bg-bolt-elements-item-backgroundActive flex items-center gap-2"
          >
            {isDeploying ? 'Deploying...' : 'Deploy'}
            <div
              className={classNames('i-ph:caret-down w-4 h-4 transition-transform', isDropdownOpen ? 'rotate-180' : '')}
            />
          </Button>
        </div>

        {isDropdownOpen && (
          <div className="absolute right-2 flex flex-col gap-1 z-50 p-1 mt-1 min-w-[13.5rem] bg-bolt-elements-background-depth-2 rounded-md shadow-lg bg-bolt-elements-backgroundDefault border border-bolt-elements-borderColor">
            <Button
              active
              onClick={() => {
                handleDeploy();
                setIsDropdownOpen(false);
              }}
              disabled={isDeploying || !activePreview || !userSession}
              className="flex items-center w-full px-4 py-2 text-sm text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive gap-2 rounded-md group relative"
            >
              <img src="/orbiter.svg" className="h-4" />
              <span className="mx-auto">{!userSession ? 'Orbiter account not connected' : 'Deploy to Orbiter'}</span>
              {userSession && <NetlifyDeploymentLink />}
            </Button>
          </div>
        )}
      </div>
      <div className="flex border border-bolt-elements-borderColor rounded-md overflow-hidden">
        <Button
          active={showChat}
          disabled={!canHideChat || isSmallViewport} // expand button is disabled on mobile as it's not needed
          onClick={() => {
            if (canHideChat) {
              chatStore.setKey('showChat', !showChat);
            }
          }}
        >
          <div className="i-bolt:chat text-sm" />
        </Button>
        <div className="w-[1px] bg-bolt-elements-borderColor" />
        <Button
          active={showWorkbench}
          onClick={() => {
            if (showWorkbench && !showChat) {
              chatStore.setKey('showChat', true);
            }

            workbenchStore.showWorkbench.set(!showWorkbench);
          }}
        >
          <div className="i-ph:code-bold" />
        </Button>
      </div>
    </div>
  );
}

interface ButtonProps {
  active?: boolean;
  disabled?: boolean;
  children?: any;
  onClick?: VoidFunction;
  className?: string;
}

function Button({ active = false, disabled = false, children, onClick, className }: ButtonProps) {
  return (
    <button
      className={classNames(
        'flex items-center p-1.5',
        {
          'bg-bolt-elements-item-backgroundDefault hover:bg-bolt-elements-item-backgroundActive text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary':
            !active,
          'bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent': active && !disabled,
          'bg-bolt-elements-item-backgroundDefault text-alpha-gray-20 dark:text-alpha-white-20 cursor-not-allowed':
            disabled,
        },
        className,
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
