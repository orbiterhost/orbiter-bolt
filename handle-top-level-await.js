// plugins/handle-top-level-await.js
import { createFilter } from '@rollup/pluginutils';
import MagicString from 'magic-string';

/**
 * Vite plugin to transform top-level await in a way that's compatible with Cloudflare Workers
 */
export default function handleTopLevelAwait() {
  // Create filters to select which files to transform
  const filter = createFilter([
    '**/*.js', '**/*.jsx', '**/*.ts', '**/*.tsx', '**/*.mjs',
    '**/node_modules/**/*.mjs', // ESM modules may use top-level await
  ]);

  return {
    name: 'handle-top-level-await',
    enforce: 'pre', // Run before other plugins

    async transform(code, id) {
      // Skip if not matching our filter
      if (!filter(id)) {
        return null;
      }

      // Skip if no await keyword
      if (!code.includes('await ') || id.includes('node_modules/vite')) {
        return null;
      }

      // Use MagicString for source map generation
      const magicString = new MagicString(code);
      let hasChanges = false;

      // Detect export declarations with await
      const exportAwaitRegex = /export\s+(const|let|var|async|function)\s+([a-zA-Z0-9_$]+)(?:\s*=\s*|\s*\([^)]*\)\s*(?:=>)?\s*{[^}]*)\s*await\s+/g;
      let match;
      
      while ((match = exportAwaitRegex.exec(code)) !== null) {
        const exportType = match[1]; // const, let, var, async, function
        const exportName = match[2]; // variable or function name
        const startPos = match.index;
        
        // Find the end of this export statement
        const exportEndRegex = /;|\n|}/g;
        exportEndRegex.lastIndex = startPos + match[0].length;
        const endMatch = exportEndRegex.exec(code);
        const endPos = endMatch ? endMatch.index + 1 : code.length;
        
        // Get the full export statement
        const fullExport = code.substring(startPos, endPos);
        
        // Skip if it's a nested await inside a function
        if (/function|async/.test(exportType) && !fullExport.includes('=>')) {
          continue;
        }
        
        // Replace the export with a local variable and add export at the end
        const localVar = fullExport.replace(/export\s+(const|let|var)\s+/, 'let ');
        const nonAwaitVersion = exportType === 'const' || exportType === 'let' || exportType === 'var'
          ? `export ${exportType} ${exportName} = undefined; // Placeholder for async-initialized value`
          : `// Export will be created after async initialization`;
        
        // Create an async initializer
        const asyncInit = `
// Handle top-level await in export
${nonAwaitVersion}
(async () => {
  try {
    ${localVar}
    ${exportName} = ${exportName}; // Update the exported value
  } catch (e) {
    console.error("Error in top-level await export:", e);
  }
})();
`;
        
        // Replace the export statement
        magicString.overwrite(startPos, endPos, asyncInit);
        hasChanges = true;
      }

      // Handle regular top-level await that aren't inside exports
      const awaitRegex = /\bawait\s+/g;
      awaitRegex.lastIndex = 0; // Reset index
      
      while ((match = awaitRegex.exec(code)) !== null) {
        const awaitPos = match.index;

        // Check if this await is inside an export statement (already handled above)
        const beforeAwait = code.substring(0, awaitPos);
        if (beforeAwait.lastIndexOf('export') > beforeAwait.lastIndexOf(';')) {
          continue;
        }
        
        // Check if this is potentially a top-level await (not inside a function)
        let isTopLevel = true;
        let braceLevel = 0;
        let inFunction = false;
        let inString = false;
        let stringChar = '';
        let inComment = false;
        
        for (let i = 0; i < awaitPos; i++) {
          const char = code[i];
          const nextChar = code[i + 1];
          
          // Skip comments
          if (!inString && char === '/' && nextChar === '/') {
            inComment = 'line';
          } else if (!inString && char === '/' && nextChar === '*') {
            inComment = 'block';
          } else if (inComment === 'line' && char === '\n') {
            inComment = false;
          } else if (inComment === 'block' && char === '*' && nextChar === '/') {
            inComment = false;
            i++; // Skip the closing slash
          }
          
          if (inComment) continue;
          
          // Handle strings
          if (!inString && (char === '"' || char === "'" || char === '`')) {
            inString = true;
            stringChar = char;
          } else if (inString && char === stringChar && code[i - 1] !== '\\') {
            inString = false;
          }
          
          if (inString) continue;
          
          // Count braces
          if (char === '{') {
            braceLevel++;
          } else if (char === '}') {
            braceLevel--;
          }
          
          // Check for function declaration/expression
          if ((code.slice(i, i + 8) === 'function' || 
               code.slice(i, i + 5) === 'async' ||
               code.slice(i, i + 2) === '=>') && 
              /[\s{(]/.test(code[i + (code.slice(i, i + 8) === 'function' ? 8 : code.slice(i, i + 5) === 'async' ? 5 : 2)])) {
            inFunction = true;
          }
        }
        
        // If this isn't a top-level await, skip it
        if (braceLevel > 0 || inFunction) {
          continue;
        }
        
        // Find the statement containing the await
        let startPos = awaitPos;
        while (startPos > 0 && !/[;{}]/.test(code[startPos - 1])) {
          startPos--;
        }
        
        let endPos = awaitPos;
        let parenLevel = 0;
        while (endPos < code.length) {
          const char = code[endPos];
          if (char === '(') parenLevel++;
          else if (char === ')') parenLevel--;
          else if (char === ';' && parenLevel === 0) break;
          
          endPos++;
        }
        
        // Include the semicolon if present
        if (endPos < code.length && code[endPos] === ';') {
          endPos++;
        }
        
        // Extract the full statement with the await
        const fullStatement = code.slice(startPos, endPos).trim();
        
        // Skip if it's an assignment to an exported variable (handled above)
        if (/^[a-zA-Z0-9_$]+ =/.test(fullStatement) && 
            beforeAwait.includes('export') && 
            beforeAwait.includes(fullStatement.split('=')[0].trim())) {
          continue;
        }
        
        // Generate a unique variable name for the result
        const varName = `__tla_result_${Math.floor(Math.random() * 1000000)}`;
        
        // Create an immediately-invoked async function expression
        const replacement = `
// Top-level await wrapper
let ${varName};
(async () => {
  try {
    ${varName} = ${fullStatement};
  } catch (e) {
    console.error("Error in top-level await:", e);
  }
})();
`;
        
        // Replace the original statement
        magicString.overwrite(startPos, endPos, replacement);
        hasChanges = true;
      }
      
      if (hasChanges) {
        return {
          code: magicString.toString(),
          map: magicString.generateMap({ hires: true })
        };
      }
      
      return null;
    }
  };
}