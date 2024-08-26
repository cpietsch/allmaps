<script>
  let resources = [
    { name: 'Manifest A', children: ['Map 1', 'Map 2'] },
    { name: 'IIIF Image A' },
    { name: 'IIIF Collection', children: ['Manifest A', 'Manifest B'] },
    { name: 'IIIF Image B' }
  ];

  let maps = [
    { name: 'Amsterdam', children: ['North', 'West', 'East', 'South'] }
  ];

  let details = {
    referenced: '5 of 10',
    editor: true,
    viewer: true
  };
</script>

<div class="flex h-screen bg-gray-100 p-4">
  <div class="w-1/3 bg-white shadow-md rounded-lg p-4 mr-4">
    <div class="flex justify-between items-center mb-4">
      <h2 class="text-xl font-bold">Resources</h2>
      <div>
        <button class="p-2 bg-gray-200 rounded-md mr-2">+</button>
        <button class="p-2 bg-gray-200 rounded-md">=</button>
      </div>
    </div>
    <ul>
      {#each resources as resource}
        <li class="mb-2">
          <span class="font-medium">- {resource.name}</span>
          {#if resource.children}
            <ul class="ml-4">
              {#each resource.children as child}
                <li>| {child}</li>
              {/each}
            </ul>
          {/if}
        </li>
      {/each}
    </ul>
  </div>

  <div class="w-1/3 bg-white shadow-md rounded-lg p-4 mr-4">
    <div class="flex justify-between items-center mb-4">
      <h2 class="text-xl font-bold">Maps of Amsterdam</h2>
      <button class="p-2 bg-gray-200 rounded-md">=</button>
    </div>
    <ul>
      {#each maps as map}
        <li class="mb-2">
          <div class="flex items-center">
            <span class="font-medium">- {map.name}</span>
            <div class="ml-auto flex items-center">
              <div class="w-24 h-2 bg-green-500 rounded-full mr-2"></div>
              <button class="p-1 bg-gray-200 rounded-md">+</button>
            </div>
          </div>
          {#if map.children}
            <ul class="ml-4">
              {#each map.children as child}
                <li>| {child}</li>
              {/each}
            </ul>
          {/if}
        </li>
      {/each}
    </ul>
  </div>

  <div class="w-1/3 bg-white shadow-md rounded-lg p-4">
    <h2 class="text-xl font-bold mb-4">Details</h2>
    <div class="mb-2">
      <span class="font-medium">Referenced</span>
      <span class="float-right">{details.referenced}</span>
    </div>
    <div class="mb-2">
      <span class="font-medium">Editor</span>
      <input type="checkbox" checked={details.editor} class="float-right" />
    </div>
    <div>
      <span class="font-medium">Viewer</span>
      <input type="checkbox" checked={details.viewer} class="float-right" />
    </div>
  </div>
</div>