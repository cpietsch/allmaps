<script lang="ts">
  import { melt, createSlider, type CreateSliderProps } from '@melt-ui/svelte'
  import { last } from '@melt-ui/svelte/internal/helpers'

  export let label: string | undefined = undefined

  const onValueChange: CreateSliderProps['onValueChange'] = ({
    curr,
    next
  }) => {
    // if (!someCondition) {
    //   return curr
    // }
    console.log('onValueChange', curr, next)
    return next
  }

  const {
    elements: { root, range, thumb },
    states: { value }
  } = createSlider({
    defaultValue: [30],
    min: 0,
    max: 100,
    step: 1,
    orientation: 'vertical',
    onValueChange
  })

  let lastValue = $value
  let hover = false

  // $: lastValue = $value
  //   $: console.log("lastValue",lastValue)
</script>

<span
  use:melt={$root}
  class="relative flex h-[100px] w-[3px] flex-col items-center mr-3"
  on:mouseenter={(e) => {
    hover = true
  }}
  on:mouseleave={(e) => {
    hover = false
  }}
>
  <span
    class="absolute w-full top-[-2em] text-center text-xs"
    class:opacity-0={!hover}
  >
    {label}
  </span>
  <!-- <span class="h-[3px] w-full bg-black/40" class:opacity-0={!hover}>
    <span use:melt={$range} class="h-[3px] bg-white" />
  </span> -->
  <span class="h-[200px] w-full bg-black/40" class:opacity-0={!hover}>
    <span use:melt={$range} class="w-full bg-white" />
  </span>
  <span
    use:melt={$thumb()}
    on:click={(e) => {
      // on:m-click ist not working
      // https://melt-ui.com/docs/controlled
      // e.preventDefault()
      // // console.log('click', $value, lastValue)
      // if (lastValue[0] === $value[0]) {
      //   value.set([0])
      // }
      console.log('click', $value, lastValue)
      lastValue = $value
    }}
    class="text-center h-6 w-6 rounded-full bg-white shadow-sm cursor-pointer border border-black/50 border-width-[2px]"
    >{label?.slice(0, 1)}</span
  >
</span>
