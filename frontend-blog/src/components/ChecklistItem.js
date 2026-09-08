import { InputRule, wrappingInputRule } from '@tiptap/core'
import { Fragment } from '@tiptap/pm/model'
import { TextSelection } from '@tiptap/pm/state'
import TaskItem from '@tiptap/extension-task-item'

const checklistPrefix = /^\s*(?:[-+*]\s+)?\[([ xX]?)\]\s$/

export default TaskItem.extend({
  addInputRules() {
    return [
      new InputRule({
        find: checklistPrefix,
        handler: ({ state, range, match }) => {
          const original = state.doc.resolve(range.from)
          let itemDepth = original.depth
          while (itemDepth > 0 && !['listItem', 'taskItem'].includes(original.node(itemDepth).type.name)) itemDepth -= 1
          if (!itemDepth || original.node(itemDepth).type.name !== 'listItem') return null

          // The preceding "- " already created a bullet item. Split its list
          // around this item, so converting it does not change its siblings.
          const tr = state.tr.delete(range.from, range.to)
          const start = tr.doc.resolve(range.from)
          const listDepth = itemDepth - 1
          const list = start.node(listDepth)
          const itemIndex = start.index(listDepth)
          const before = []
          const after = []
          list.forEach((node, _, index) => {
            if (index < itemIndex) before.push(node)
            if (index > itemIndex) after.push(node)
          })
          const converted = this.type.create({ checked: match[1].toLowerCase() === 'x' }, start.node(itemDepth).content)
          const taskList = state.schema.nodes.taskList.create(null, converted)
          const replacement = []
          if (before.length) replacement.push(list.copy(Fragment.fromArray(before)))
          const taskPosition = start.before(listDepth) + (replacement[0]?.nodeSize || 0)
          replacement.push(taskList)
          if (after.length) {
            const attrs = list.type.name === 'orderedList' ? { ...list.attrs, start: (list.attrs.start || 1) + itemIndex + 1 } : list.attrs
            replacement.push(list.type.create(attrs, Fragment.fromArray(after)))
          }
          tr.replaceWith(start.before(listDepth), start.after(listDepth), Fragment.fromArray(replacement))
          tr.setSelection(TextSelection.create(tr.doc, taskPosition + 3))
        },
      }),
      wrappingInputRule({
        find: checklistPrefix,
        type: this.type,
        getAttributes: match => ({ checked: match[1].toLowerCase() === 'x' }),
      }),
    ]
  },
})
