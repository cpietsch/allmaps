<script lang="ts">
  import { melt, createSlider, type CreateSliderProps } from '@melt-ui/svelte'
  import { last } from '@melt-ui/svelte/internal/helpers'

  export let label: string | undefined = undefined
  export let evalue: number = 0

  const onValueChange: CreateSliderProps['onValueChange'] = ({
    curr,
    next
  }) => {
    if (Math.abs(curr[0] - next[0]) < 10) {
      return curr
    }
    return next
  }

  const {
    elements: { root, range, thumb },
    states: { value }
  } = createSlider({
    defaultValue: [evalue * 100],
    min: 0,
    max: 100,
    step: 1
    // onValueChange
  })

  let lastValue = $value
  let hover = false

  $: {
    evalue = $value[0] / 100
  }

  // $: lastValue = $value
  // $: console.log("lastValue",lastValue)
</script>

<span
  class="relative flex flex-col items-center p-4 rounded-md shadow-sm"
  class:bg-white={hover}
  on:mouseenter={(e) => {
    hover = true
  }}
  on:mouseleave={(e) => {
    hover = false
  }}
>
  <span class="w-full text-xs mb-1 text-center" class:opacity-0={!hover}>
    {label}
  </span>
  <span class="relative flex h-[30px] w-[100px] items-center" use:melt={$root}>
    <span class="h-[3px] w-full bg-black/20" class:opacity-0={!hover}>
      <span use:melt={$range} class="h-[3px] bg-gray" />
    </span>
    <span
      use:melt={$thumb()}
      on:pointerdown={(e) => {
        lastValue = $value
        // console.log('pointerdown', lastValue, $value)
      }}
      on:pointerup={(e) => {
        // console.log('pointerup', lastValue, $value)
        if (Math.abs(lastValue[0] - $value[0]) < 10) {
          value.set([0])
          lastValue = [0]
        }
      }}
      class="flex justify-center items-center text-xs h-6 w-6 rounded-full bg-white shadow-sm cursor-pointer border border-black/50 border-width-[2px]"
      >{label?.slice(0, 1)}</span
    >
  </span>
</span>
