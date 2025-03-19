// plugins/handle-side-effects.js

/**
 * Vite plugin to force inclusion of packages that are marked with sideEffects: false
 * but are actually needed for the application to function properly
 */
export default function handleSideEffects() {
    // List of packages that should be forced to include despite sideEffects: false
    const packagesToForce = [
      'react-icons/bi',
      'react-icons/fa',
      'react-icons/fi',
      'react-icons/md',
      'react-icons/io',
      'react-icons/hi',
      'react-icons/ai',
      'react-icons/bs',
      'react-icons/gi',
      'react-icons/si',
      'react-icons/im',
      'react-icons/ti',
      'react-icons/go',
      'react-icons/ri',
      'react-icons/cg',
      'react-icons/vsc',
      'react-chartjs-2',
      'chart.js',
      'isomorphic-git',
      '@octokit/rest',
      'shiki',
      '@phosphor-icons/react',
      '@tanstack/react-virtual',
      '@headlessui/react',
      'framer-motion',
      'zustand',
      'nanostores',
      '@nanostores/react',
      '@radix-ui/*'
    ];
  
    // Create a virtual module ID
    const virtualModuleId = 'virtual:force-side-effects';
    const resolvedVirtualModuleId = '\0' + virtualModuleId;
  
    return {
      name: 'vite-plugin-force-side-effects',
      
      resolveId(id) {
        if (id === virtualModuleId) {
          return resolvedVirtualModuleId;
        }
      },
      
      load(id) {
        if (id === resolvedVirtualModuleId) {
          // Create a module that imports all the packages we want to force
          const imports = packagesToForce.map(pkg => {
            // Handle wildcard patterns
            if (pkg.endsWith('/*')) {
              const basePkg = pkg.slice(0, -2);
              
              // For @radix-ui/* and similar patterns, let's enumerate specific packages
              // This is a simplified example - in production you might want to be more specific
              if (basePkg === '@radix-ui') {
                return [
                  `import '@radix-ui/react-collapsible';`,
                  `import '@radix-ui/react-context-menu';`,
                  `import '@radix-ui/react-dialog';`,
                  `import '@radix-ui/react-dropdown-menu';`,
                  `import '@radix-ui/react-label';`,
                  `import '@radix-ui/react-popover';`,
                  `import '@radix-ui/react-progress';`,
                  `import '@radix-ui/react-scroll-area';`,
                  `import '@radix-ui/react-separator';`,
                  `import '@radix-ui/react-switch';`,
                  `import '@radix-ui/react-tabs';`,
                  `import '@radix-ui/react-tooltip';`
                ].join('\n');
              }
              
              return `// Wildcard import for ${basePkg} would go here`;
            }
            
            return `import '${pkg}';`;
          }).join('\n');
          
          return `${imports}\n\nexport default 'Side effects forced';\n`;
        }
      },
      
      transform(code, id) {
        // Inject the import into entry points
        if (id.includes('entry.client') || id.includes('entry.server')) {
          const importStatement = `import '${virtualModuleId}';\n`;
          return {
            code: importStatement + code,
            map: null
          };
        }
        
        // For packages with side-effects false that might be causing issues,
        // we can try to modify their metadata at build time
        if (id.includes('node_modules')) {
          for (const pkg of packagesToForce) {
            const basePkg = pkg.endsWith('/*') ? pkg.slice(0, -2) : pkg;
            if (id.includes(basePkg)) {
              // This is a simplified approach and might not work for all cases
              // It adds a comment to signal to the bundler that this module has side effects
              return {
                code: `/* @vite-ignore */\n${code}`,
                map: null
              };
            }
          }
        }
        
        return null;
      }
    };
  }