<script setup lang="ts">
defineProps<{
  icon: string
  title: string
  description: string
  tone:
    | 'violet'
    | 'orange'
    | 'blue'
    | 'green'
    | 'cyan'
    | 'pink'
    | 'yellow'
    | 'slate'
}>()
</script>

<template>
  <article class="feature-tile" :data-tone="tone">
    <div class="feature-tile__icon" aria-hidden="true">
      {{ icon }}
    </div>
    <div class="feature-tile__body">
      <h3>{{ title }}</h3>
      <p>{{ description }}</p>
    </div>
  </article>
</template>
