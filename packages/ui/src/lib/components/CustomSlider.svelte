<script lang="ts">
  import { createSlider, melt } from '@melt-ui/svelte';
  import { last } from '@melt-ui/svelte/internal/helpers'

  export let label: string | undefined = undefined
 
  const {
    elements: { root, range, thumb },
    states: { value },
  } = createSlider({
    defaultValue: [30],
    min: 0,
    max: 100,
    step: 1,
  });

  let lastValue = $value
  let hover = false

//   $: lastValue = $value

//   $: console.log("lastValue",lastValue)

</script>
 
<span use:melt={$root} class="relative flex h-[20px] w-[100px] items-center" 
    on:mouseenter={(e) => {
        hover = true
    }}
    on:mouseleave={(e) => {
        hover = false
    }}
    >
<span class="absolute w-full top-[-2em] text-center text-xs" class:opacity-0={!hover}>
    {label}
</span>
  <span class="h-[3px] w-full bg-black/40" class:opacity-0={!hover}>
    <span use:melt={$range} class="h-[3px] bg-white" />
  </span>
  <span
    use:melt={$thumb()}
    on:click={(e) => {
        // on:m-click ist not working
        // https://melt-ui.com/docs/controlled
        e.preventDefault()
        // console.log('click', $value, lastValue)
        if(lastValue[0] === $value[0]) {
            value.set([0])
        }
        lastValue = $value
    }}
       
    class="h-6 w-6 rounded-full bg-white shadow-sm cursor-pointer border border-black/50 border-width-[2px]"
  />
</span>