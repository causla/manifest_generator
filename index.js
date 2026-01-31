const MODULES = {
  '@minecraft/server': ['None'],
  '@minecraft/server-ui': ['None'],
};

let loadedModuleVersions = {};
const VERSION_CACHE_KEY = 'mc_versions_cache';
const CACHE_EXPIRY_DAYS = 7;

const applyTheme = (theme) => {
  if (theme === 'system') theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  updateThemeButton(theme);
};

const updateThemeButton = (theme) => {
  const themeToggle = document.getElementById('themeToggle');
  if (theme === 'dark') themeToggle.textContent = '🌙';
  else themeToggle.textContent = '☀️';
};

const setupThemeSwitcher = () => {
  const themeToggle = document.getElementById('themeToggle');
  const themeDropdown = document.getElementById('themeDropdown');
  
  const savedTheme = localStorage.getItem('theme') || 'system';
  applyTheme(savedTheme);
  
  themeToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    themeDropdown.classList.toggle('hidden');
  });
  
  document.querySelectorAll('.theme-dropdown button').forEach(button => {
    button.addEventListener('click', () => {
      const theme = button.dataset.theme;
      applyTheme(theme);
      themeDropdown.classList.add('hidden');
    });
  });
  
  document.addEventListener('click', () => {
    themeDropdown.classList.add('hidden');
  });
  
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
    if (localStorage.getItem('theme') === 'system') applyTheme('system');
  });
};

const updateVersionDropdowns = (versions) => {
  const options = versions.map(v => `<option value="${v}">${v}</option>`).join('');
  document.getElementById("bpMinEngine").innerHTML = options;
  document.getElementById("rpMinEngine").innerHTML = options;
  loadSelectedVersion();
};

const loadSelectedVersion = () => {
  const savedData = localStorage.getItem('minecraftManifestData');
  if (!savedData) return;
  try {
    const data = JSON.parse(savedData);
    const bpSelect = document.getElementById("bpMinEngine");
    const rpSelect = document.getElementById("rpMinEngine");
    if (data.bp?.minEngine) {
      const bpOption = Array.from(bpSelect.options).find(opt => opt.value === data.bp.minEngine);
      if (bpOption) bpSelect.value = data.bp.minEngine;
    }
    if (data.rp?.minEngine) {
      const rpOption = Array.from(rpSelect.options).find(opt => opt.value === data.rp.minEngine);
      if (rpOption) rpSelect.value = data.rp.minEngine;
    }
  } catch (e) {
    console.error('Error loading selected version:', e);
  }
};

const loadCachedVersions = () => {
  const cachedData = localStorage.getItem(VERSION_CACHE_KEY);
  if (!cachedData) {
    updateVersionDropdowns(["1.21.60", "1.21.50", "1.21.40", "1.21.30", "1.21.20", "1.21.10", "1.21.0", "1.20.80", "1.20.70", "1.20.60"]);
    return;
  }
  try {
    const { versions, lastUpdated } = JSON.parse(cachedData);
    const cacheDate = new Date(lastUpdated);
    const today = new Date();
    const diffDays = Math.floor((today - cacheDate) / (1000 * 60 * 60 * 24));
    if (diffDays > CACHE_EXPIRY_DAYS) {
      fetchVersions().catch(() => updateVersionDropdowns(versions));
    } else {
      updateVersionDropdowns(versions);
    }
  } catch (e) {
    updateVersionDropdowns(["1.21.60", "1.21.50", "1.21.40", "1.21.30", "1.21.20", "1.21.10", "1.21.0", "1.20.80", "1.20.70", "1.20.60"]);
  }
};

const fetchVersions = async () => {
  try {
    const res = await fetch("https://minecraft.wiki/w/Bedrock_Edition_version_history/Development_versions");
    if (res.ok) {
      const text = await res.text();
      const doc = new DOMParser().parseFromString(text, "text/html");
      const versions = [...doc.querySelectorAll("h3 .mw-headline")].map(el => el.textContent.trim()).filter(v => !["RTX Beta", "Realms builds", "Alpha"].some(e => v.includes(e)));
      if (versions.length > 0) {
        const cacheData = {
          versions: versions,
          lastUpdated: new Date().toISOString()
        };
        localStorage.setItem(VERSION_CACHE_KEY, JSON.stringify(cacheData));
        updateVersionDropdowns(versions);
        return;
      }
    }
    loadCachedVersions();
  } catch (error) {
    console.error("Failed to fetch versions:", error);
    loadCachedVersions();
  }
};

const fetchModuleVersions = async (module) => {
  try {
    const res = await fetch(`https://registry.npmjs.org/${module}`);
    if (!res.ok) return;
    const { versions } = await res.json();
    const processed = new Set();
    Object.keys(versions).forEach(v => {
      const stable = v.match(/^\d+\.\d+\.\d+$/);
      const beta = v.match(/^(\d+\.\d+\.\d+)-beta/);
      if (stable) processed.add(v);
      if (beta) processed.add(beta[1] + '-beta');
    });
    const sortedVersions = ['None', ...[...processed].sort((a, b) => {
      const [a1, a2, a3] = a.replace(/-beta$/, '').split('.').map(Number);
      const [b1, b2, b3] = b.replace(/-beta$/, '').split('.').map(Number);
      return b1 - a1 || b2 - a2 || b3 - a3 || (a.includes('-beta') ? 1 : -1);
    })];
    MODULES[module] = sortedVersions;
    loadedModuleVersions[module] = sortedVersions;
    return sortedVersions;
  } catch (error) {
    console.error(`Failed to fetch ${module} versions:`, error);
    MODULES[module] = ['None', '1.0.0'];
    loadedModuleVersions[module] = ['None', '1.0.0'];
    return ['None', '1.0.0'];
  }
};

const generateUUID = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => ((c === 'x' ? Math.random() * 16 | 0 : (Math.random() * 16 | 0 & 0x3 | 0x8)).toString(16)));
const validateUUID = (uuid) => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid);

const checkUUIDs = () => {
  let isValid = true;
  const bpEnabled = document.getElementById('bpToggle').checked;
  const rpEnabled = document.getElementById('rpToggle').checked;
  const bothDisabled = (!bpEnabled && !rpEnabled);
  
  const bpUuid = document.getElementById('bpUuid').value.trim();
  const bpTooltip = document.getElementById('bpUuidTooltip');
  if (bpUuid && !validateUUID(bpUuid)) {
    bpTooltip.classList.remove('hidden');
    bpTooltip.classList.toggle('disabled', !bpEnabled);
    if (bpEnabled) isValid = false;
  } else bpTooltip.classList.add('hidden');
  
  const rpUuid = document.getElementById('rpUuid').value.trim();
  const rpTooltip = document.getElementById('rpUuidTooltip');
  if (rpUuid && !validateUUID(rpUuid)) {
    rpTooltip.classList.remove('hidden');
    rpTooltip.classList.toggle('disabled', !rpEnabled);
    if (rpEnabled) isValid = false;
  } else rpTooltip.classList.add('hidden');
  
  const bpDeps = Array.from(document.querySelectorAll('#bpCustomDepsContainer .dep-uuid'));
  bpDeps.forEach(dep => {
    const uuid = dep.value.trim();
    if (uuid && !validateUUID(uuid)) {
      let tooltip = dep.parentElement.querySelector('.tooltip');
      if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.className = 'tooltip';
        tooltip.textContent = 'Invalid UUID format';
        dep.parentElement.appendChild(tooltip);
      }
      tooltip.classList.remove('hidden');
      tooltip.classList.toggle('disabled', !bpEnabled);
      if (bpEnabled) isValid = false;
    } else {
      const tooltip = dep.parentElement.querySelector('.tooltip');
      if (tooltip) tooltip.classList.add('hidden');
    }
  });
  
  const rpDeps = Array.from(document.querySelectorAll('#rpCustomDepsContainer .dep-uuid'));
  rpDeps.forEach(dep => {
    const uuid = dep.value.trim();
    if (uuid && !validateUUID(uuid)) {
      let tooltip = dep.parentElement.querySelector('.tooltip');
      if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.className = 'tooltip';
        tooltip.textContent = 'Invalid UUID format';
        dep.parentElement.appendChild(tooltip);
      }
      tooltip.classList.remove('hidden');
      tooltip.classList.toggle('disabled', !rpEnabled);
      if (rpEnabled) isValid = false;
    } else {
      const tooltip = dep.parentElement.querySelector('.tooltip');
      if (tooltip) tooltip.classList.add('hidden');
    }
  });
  
  document.getElementById('generateBtn').disabled = bothDisabled ? bothDisabled : !isValid;
  return isValid;
};

const updatePanelStates = () => {
  const bpEnabled = document.getElementById('bpToggle').checked;
  const rpEnabled = document.getElementById('rpToggle').checked;
  const metaEnabled = document.getElementById('metaToggle').checked;
  const bothDisabled = (!bpEnabled && !rpEnabled);
  
  const bpFields = document.getElementById('bpFields');
  bpFields.classList.toggle('panel-content-disabled', !bpEnabled);
  document.querySelector('.bp-panel .panel-header').classList.toggle('disabled', !bpEnabled);
  
  const rpFields = document.getElementById('rpFields');
  rpFields.classList.toggle('panel-content-disabled', !rpEnabled);
  document.querySelector('.rp-panel .panel-header').classList.toggle('disabled', !rpEnabled);
  
  const metaFields = document.getElementById('metaFields');
  metaFields.classList.toggle('panel-content-disabled', bothDisabled || !metaEnabled);
  document.querySelector('.meta-panel .panel-header').classList.toggle('disabled', bothDisabled || !metaEnabled);
  
  document.getElementById('metaToggle').disabled = bothDisabled;
  document.getElementById('dependenciesToggle').disabled = !(bpEnabled && rpEnabled);
  
  document.getElementById('bpUuidTooltip').classList.toggle('disabled', !bpEnabled);
  document.querySelectorAll('#bpCustomDepsContainer .tooltip').forEach(tooltip => tooltip.classList.toggle('disabled', !bpEnabled));
  
  document.getElementById('rpUuidTooltip').classList.toggle('disabled', !rpEnabled);
  document.querySelectorAll('#rpCustomDepsContainer .tooltip').forEach(tooltip => tooltip.classList.toggle('disabled', !rpEnabled));
};

const createModuleSelectors = (selectedVersions = {}) => {
  const container = document.getElementById('bpScriptModules');
  container.innerHTML = Object.entries(MODULES).map(([module, versions]) => `
    <div class="module-selector">
      <label>${module}</label>
      <select class="module-select" data-module="${module}">
        ${versions.map(v => `<option value="${v}" ${selectedVersions[module] === v ? 'selected' : ''}>${v}</option>`).join('')}
      </select>
    </div>
  `).join('');
  container.querySelectorAll('.module-select').forEach(select => {
    select.addEventListener('change', saveData);
  });
};

const addSubpack = (containerId, data = {}) => {
  const container = document.getElementById(containerId);
  const subpackDiv = document.createElement('div');
  subpackDiv.className = 'item subpack-item';
  subpackDiv.innerHTML = `
    <button class="item-remove remove-subpack" title="Remove subpack">×</button>
    <div class="item-grid">
      <div class="input-container">
        <input type="text" class="subpack-name" placeholder=" " value="${data.name || ''}">
        <label>Name</label>
      </div>
      <div class="input-container">
        <input type="text" class="subpack-folder" placeholder=" " value="${data.folder || ''}">
        <label>Folder name</label>
      </div>
      <div class="input-container">
        <input type="number" class="subpack-tier" placeholder=" " min="0" value="${data.tier || 0}">
        <label>Memory tier</label>
      </div>
    </div>
  `;
  container.appendChild(subpackDiv);
  subpackDiv.querySelectorAll('input').forEach(input => {
    input.addEventListener('change', saveData);
    input.addEventListener('input', saveData);
  });
  subpackDiv.querySelector('.remove-subpack').addEventListener('click', () => {
    container.removeChild(subpackDiv);
    saveData();
  });
};

const addCustomDep = (containerId, data = {}) => {
  const container = document.getElementById(containerId);
  const depDiv = document.createElement('div');
  depDiv.className = 'item dependency-item';
  depDiv.innerHTML = `
    <button class="item-remove remove-dep" title="Remove dependency">×</button>
    <div class="item-grid">
      <div class="input-container">
        <input type="text" class="dep-uuid" placeholder=" " value="${data.uuid || ''}">
        <label>UUID</label>
      </div>
      <div class="input-container">
        <input type="text" class="dep-version" placeholder=" " value="${data.version || '1.0.0'}">
        <label>Version</label>
      </div>
      <div class="input-container">
        <input type="text" class="dep-name" placeholder=" " value="${data.name || ''}">
        <label>Description (optional)</label>
      </div>
    </div>
  `;
  container.appendChild(depDiv);
  depDiv.querySelectorAll('input').forEach(input => {
    input.addEventListener('change', saveData);
    input.addEventListener('input', saveData);
  });
  depDiv.querySelector('.remove-dep').addEventListener('click', () => {
    container.removeChild(depDiv);
    saveData();
  });
};

const addAuthor = (name = '') => {
  const container = document.getElementById('metaAuthorsContainer');
  const authorDiv = document.createElement('div');
  authorDiv.className = 'item author-item';
  authorDiv.innerHTML = `
    <button class="item-remove remove-author" title="Remove author">×</button>
    <div class="item-grid">
      <div class="input-container">
        <input type="text" class="author-name" placeholder=" " value="${name}">
        <label>Author name</label>
      </div>
    </div>
  `;
  container.appendChild(authorDiv);
  authorDiv.querySelector('input').addEventListener('change', saveData);
  authorDiv.querySelector('input').addEventListener('input', saveData);
  authorDiv.querySelector('.remove-author').addEventListener('click', () => {
    container.removeChild(authorDiv);
    saveData();
  });
};

const addTool = (data = {}) => {
  const container = document.getElementById('metaToolsContainer');
  const toolDiv = document.createElement('div');
  toolDiv.className = 'item tool-item';
  toolDiv.innerHTML = `
    <button class="item-remove remove-tool" title="Remove tool">×</button>
    <div class="item-grid">
      <div class="input-container">
        <input type="text" maxLength="32" class="tool-name" placeholder=" " value="${data.name || ''}">
        <label>Tool name</label>
      </div>
      <div class="input-container">
        <input type="text" class="tool-version" placeholder=" " value="${data.version || ''}">
        <label>Version</label>
      </div>
    </div>
  `;
  container.appendChild(toolDiv);
  toolDiv.querySelectorAll('input').forEach(input => {
    input.addEventListener('change', saveData);
    input.addEventListener('input', saveData);
  });
  toolDiv.querySelector('.remove-tool').addEventListener('click', () => {
    container.removeChild(toolDiv);
    saveData();
  });
};

const saveData = () => {
  const data = {
    meta: {
      enabled: document.getElementById('metaToggle').checked,
      license: document.getElementById('metaLicense').value,
      url: document.getElementById('metaUrl').value,
      authors: Array.from(document.querySelectorAll('#metaAuthorsContainer .author-item')).map(item => 
        item.querySelector('.author-name').value.trim()
      ).filter(name => name),
      tools: Array.from(document.querySelectorAll('#metaToolsContainer .tool-item')).map(item => ({
        name: item.querySelector('.tool-name').value.trim(),
        version: item.querySelector('.tool-version').value.trim()
      })).filter(tool => tool.name || tool.version)
    },
    bp: {
      enabled: document.getElementById('bpToggle').checked,
      name: document.getElementById('bpName').value,
      desc: document.getElementById('bpDesc').value,
      uuid: document.getElementById('bpUuid').value,
      minEngine: document.getElementById('bpMinEngine').value,
      scriptsEnabled: document.getElementById('bpScriptsToggle').checked,
      scriptLocation: document.getElementById('scriptLocation').value,
      moduleVersions: Array.from(document.querySelectorAll('.module-select')).reduce((acc, select) => {
        acc[select.dataset.module] = select.value;
        return acc;
      }, {}),
      subpacks: Array.from(document.querySelectorAll('#bpSubpacksContainer .subpack-item')).map(item => ({
        name: item.querySelector('.subpack-name').value,
        folder: item.querySelector('.subpack-folder').value,
        tier: parseInt(item.querySelector('.subpack-tier').value) || 0
      })),
      customDeps: Array.from(document.querySelectorAll('#bpCustomDepsContainer .dependency-item')).map(item => ({
        uuid: item.querySelector('.dep-uuid').value.trim(),
        version: item.querySelector('.dep-version').value.trim() || '1.0.0',
        name: item.querySelector('.dep-name').value.trim()
      })).filter(dep => dep.uuid)
    },
    rp: {
      enabled: document.getElementById('rpToggle').checked,
      name: document.getElementById('rpName').value,
      desc: document.getElementById('rpDesc').value,
      uuid: document.getElementById('rpUuid').value,
      minEngine: document.getElementById('rpMinEngine').value,
      subpacks: Array.from(document.querySelectorAll('#rpSubpacksContainer .subpack-item')).map(item => ({
        name: item.querySelector('.subpack-name').value,
        folder: item.querySelector('.subpack-folder').value,
        tier: parseInt(item.querySelector('.subpack-tier').value) || 0
      })),
      customDeps: Array.from(document.querySelectorAll('#rpCustomDepsContainer .dependency-item')).map(item => ({
        uuid: item.querySelector('.dep-uuid').value.trim(),
        version: item.querySelector('.dep-version').value.trim() || '1.0.0',
        name: item.querySelector('.dep-name').value.trim()
      })).filter(dep => dep.uuid)
    },
    linkDeps: document.getElementById('dependenciesToggle').checked
  };
  localStorage.setItem('minecraftManifestData', JSON.stringify(data));
  checkUUIDs();
};

const loadData = async () => {
  const savedData = localStorage.getItem('minecraftManifestData');
  if (!savedData) return;
  const data = JSON.parse(savedData);
  document.getElementById('metaToggle').checked = data.meta?.enabled ?? true;
  document.getElementById('metaLicense').value = data.meta?.license || '';
  document.getElementById('metaUrl').value = data.meta?.url || '';
  document.getElementById('metaAuthorsContainer').innerHTML = '';
  data.meta?.authors?.forEach(author => addAuthor(author));
  document.getElementById('metaToolsContainer').innerHTML = '';
  data.meta?.tools?.forEach(tool => addTool(tool));
  document.getElementById('bpToggle').checked = data.bp?.enabled ?? true;
  document.getElementById('bpName').value = data.bp?.name || 'My Behavior Pack';
  document.getElementById('bpDesc').value = data.bp?.desc || 'My awesome behavior pack';
  document.getElementById('bpUuid').value = data.bp?.uuid || '';
  document.getElementById('bpMinEngine').value = data.bp?.minEngine || '1.21.60';
  document.getElementById('bpScriptsToggle').checked = data.bp?.scriptsEnabled ?? false;
  document.getElementById('scriptLocation').value = data.bp?.scriptLocation || 'scripts/main.js';
  document.getElementById('bpSubpacksContainer').innerHTML = '';
  data.bp?.subpacks?.forEach(subpack => addSubpack('bpSubpacksContainer', subpack));
  document.getElementById('bpCustomDepsContainer').innerHTML = '';
  data.bp?.customDeps?.forEach(dep => addCustomDep('bpCustomDepsContainer', dep));
  document.getElementById('rpToggle').checked = data.rp?.enabled ?? true;
  document.getElementById('rpName').value = data.rp?.name || 'My Resource Pack';
  document.getElementById('rpDesc').value = data.rp?.desc || 'My awesome resource pack';
  document.getElementById('rpUuid').value = data.rp?.uuid || '';
  document.getElementById('rpMinEngine').value = data.rp?.minEngine || '1.21.60';
  document.getElementById('rpSubpacksContainer').innerHTML = '';
  data.rp?.subpacks?.forEach(subpack => addSubpack('rpSubpacksContainer', subpack));
  document.getElementById('rpCustomDepsContainer').innerHTML = '';
  data.rp?.customDeps?.forEach(dep => addCustomDep('rpCustomDepsContainer', dep));
  document.getElementById('dependenciesToggle').checked = data.linkDeps ?? false;
  document.getElementById('scriptLocationContainer').style.display = data.bp?.scriptsEnabled ? 'block' : 'none';
  if (data.bp?.scriptsEnabled) {
    try {
      await Promise.all(Object.keys(MODULES).map(module => fetchModuleVersions(module)));
      createModuleSelectors(data.bp?.moduleVersions || {});
      document.getElementById('bpScriptModules').classList.remove('hidden');
    } catch (error) {
      console.error("Error loading module versions:", error);
    }
  }
  updatePanelStates();
  checkUUIDs();
};

const generateManifest = () => {
  if (!checkUUIDs()) return;
  saveData();
  const bpEnabled = document.getElementById('bpToggle').checked;
  const rpEnabled = document.getElementById('rpToggle').checked;
  const metaEnabled = document.getElementById('metaToggle').checked;
  const linkDeps = document.getElementById('dependenciesToggle').checked;
  const scriptsEnabled = document.getElementById('bpScriptsToggle').checked;
  const bpUUID = document.getElementById('bpUuid').value.trim() || generateUUID();
  const rpUUID = document.getElementById('rpUuid').value.trim() || generateUUID();
  const moduleUUID = generateUUID();
  const versionParts = [1, 0, 0];
  document.getElementById('bpOutputContent').textContent = '';
  document.getElementById('rpOutputContent').textContent = '';
  const metaData = metaEnabled ? {
    authors: Array.from(document.querySelectorAll('#metaAuthorsContainer .author-item')).map(item => 
      item.querySelector('.author-name').value.trim()
    ).filter(name => name),
    license: document.getElementById('metaLicense').value.trim() || undefined,
    url: document.getElementById('metaUrl').value.trim() || undefined,
    generated_with: Array.from(document.querySelectorAll('#metaToolsContainer .tool-item')).reduce((acc, item) => {
      const name = item.querySelector('.tool-name').value.trim();
      const version = item.querySelector('.tool-version').value.trim();
      if (name && version) acc[name] = [version];
      return acc;
    }, {})
  } : undefined;
  if (bpEnabled) {
    const bpSubpacks = Array.from(document.querySelectorAll('#bpSubpacksContainer .subpack-item')).map(item => ({
      folder_name: item.querySelector('.subpack-folder').value || 'subpack',
      name: item.querySelector('.subpack-name').value || 'Unnamed Subpack',
      memory_tier: parseInt(item.querySelector('.subpack-tier').value) || 0
    }));
    const bpCustomDeps = Array.from(document.querySelectorAll('#bpCustomDepsContainer .dependency-item')).map(item => ({
      uuid: item.querySelector('.dep-uuid').value.trim(),
      version: item.querySelector('.dep-version').value.trim() || '1.0.0',
      description: item.querySelector('.dep-name').value.trim()
    })).filter(dep => dep.uuid);
    const minEngineVersion = document.getElementById('bpMinEngine').value;
    const engineParts = minEngineVersion.split('.').map(Number);
    const bpManifest = {
      format_version: 2,
      metadata: {"product_type":"addon"},
      header: {
        name: document.getElementById('bpName').value || 'My Behavior Pack',
        description: document.getElementById('bpDesc').value || 'My awesome behavior pack',
        min_engine_version: engineParts,
        uuid: bpUUID,
        version: versionParts
      },
      modules: [scriptsEnabled ? {
        description: "behavior",
        type: "script",
        uuid: moduleUUID,
        version: versionParts,
        language: "javascript",
        entry: document.getElementById('scriptLocation').value || "scripts/main.js"
      } : {
        description: "data",
        type: "data",
        uuid: moduleUUID,
        version: versionParts
      }],
      dependencies: [],
      subpacks: []
    };
    if (metaEnabled && metaData && Object.keys(metaData).some(key => metaData[key] !== undefined && (Array.isArray(metaData[key]) ? metaData[key].length > 0 : true))) {
      bpManifest.metadata = {...metaData, product_type: "addon"};
    }
    if (scriptsEnabled) Array.from(document.querySelectorAll('.module-select')).forEach(select => select.value !== 'None' && bpManifest.dependencies.push({ module_name: select.dataset.module, version: select.value }));
    if (linkDeps && rpEnabled) bpManifest.dependencies.push({ uuid: rpUUID, version: versionParts });
    bpManifest.dependencies.push(...bpCustomDeps.map(dep => ({ uuid: dep.uuid, version: dep.version.split('.').map(Number) })));
    if (bpSubpacks.length > 0) bpManifest.subpacks = bpSubpacks;
    document.getElementById('bpOutputContent').textContent = JSON.stringify(bpManifest, null, 4);
  }
  if (rpEnabled) {
    const rpSubpacks = Array.from(document.querySelectorAll('#rpSubpacksContainer .subpack-item')).map(item => ({
      folder_name: item.querySelector('.subpack-folder').value || 'subpack',
      name: item.querySelector('.subpack-name').value || 'Unnamed Subpack',
      memory_tier: parseInt(item.querySelector('.subpack-tier').value) || 0
    }));
    const rpCustomDeps = Array.from(document.querySelectorAll('#rpCustomDepsContainer .dependency-item')).map(item => ({
      uuid: item.querySelector('.dep-uuid').value.trim(),
      version: item.querySelector('.dep-version').value.trim() || '1.0.0',
      description: item.querySelector('.dep-name').value.trim()
    })).filter(dep => dep.uuid);
    const minEngineVersion = document.getElementById('rpMinEngine').value;
    const engineParts = minEngineVersion.split('.').map(Number);
    const rpManifest = {
      format_version: 2,
      metadata: {},
      header: {
        name: document.getElementById('rpName').value || 'My Resource Pack',
        description: document.getElementById('rpDesc').value || 'My awesome resource pack',
        min_engine_version: engineParts,
        uuid: rpUUID,
        version: versionParts
      },
      modules: [{
        description: "resource",
        type: "resources",
        uuid: generateUUID(),
        version: versionParts
      }],
      dependencies: [],
      subpacks: []
    };
    if (metaEnabled && Object.keys(metaData).length > 0) rpManifest.metadata = metaData;
    if (linkDeps && bpEnabled) rpManifest.dependencies.push({ uuid: bpUUID, version: versionParts });
    rpManifest.dependencies.push(...rpCustomDeps.map(dep => ({ uuid: dep.uuid, version: dep.version.split('.').map(Number) })));
    if (rpSubpacks.length > 0) rpManifest.subpacks = rpSubpacks;
    document.getElementById('rpOutputContent').textContent = JSON.stringify(rpManifest, null, 4);
  }
};

const copyToClipboard = async (id) => {
  const content = document.getElementById(id).textContent;
  if (!content.trim()) return;
  try {
    await navigator.clipboard.writeText(content);
    const btn = document.querySelector(`.copy-btn[data-target="${id}"]`);
    const iconSpan = btn.querySelector('.copy-icon');
    const originalText = iconSpan.textContent;
    iconSpan.textContent = '⎘ COPIED!';
    setTimeout(() => iconSpan.textContent = originalText, 2000);
  } catch (error) {
    console.error('Failed to copy:', error);
  }
};

document.addEventListener('DOMContentLoaded', async () => {
  setupThemeSwitcher();
  fetchVersions();
  await Promise.all(Object.keys(MODULES).map(module => fetchModuleVersions(module)));
  
  document.getElementById('bpToggle').addEventListener('change', () => {
    updatePanelStates();
    saveData();
  });
  document.getElementById('rpToggle').addEventListener('change', () => {
    updatePanelStates();
    saveData();
  });
  document.getElementById('metaToggle').addEventListener('change', () => {
    updatePanelStates();
    saveData();
  });
  document.getElementById('generateBtn').addEventListener('click', generateManifest);
  document.getElementById('bpScriptsToggle').addEventListener('change', function() {
    document.getElementById('bpScriptModules').classList.toggle('hidden', !this.checked);
    document.getElementById('scriptLocationContainer').style.display = this.checked ? 'block' : 'none';
    if (this.checked) createModuleSelectors();
    saveData();
  });
  document.getElementById('addBpSubpack').addEventListener('click', () => addSubpack('bpSubpacksContainer'));
  document.getElementById('addRpSubpack').addEventListener('click', () => addSubpack('rpSubpacksContainer'));
  document.getElementById('addBpCustomDep').addEventListener('click', () => addCustomDep('bpCustomDepsContainer'));
  document.getElementById('addRpCustomDep').addEventListener('click', () => addCustomDep('rpCustomDepsContainer'));
  document.getElementById('addMetaAuthor').addEventListener('click', () => addAuthor());
  document.getElementById('addMetaTool').addEventListener('click', () => addTool());
  document.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      copyToClipboard(btn.dataset.target);
    });
  });
  document.querySelectorAll('input, select').forEach(el => {
    el.addEventListener('change', saveData);
    el.addEventListener('input', saveData);
  });
  
  await loadData();
  updatePanelStates();
});
