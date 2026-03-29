import { describe, expect, it } from "vitest"

import { getToolbarTooltipTriggerProps } from "./toolbar"

describe("getToolbarTooltipTriggerProps", () => {
  it("renders the toolbar control through the trigger render prop by default", () => {
    const trigger = <button type="button">Bold</button>
    const props = getToolbarTooltipTriggerProps(trigger)

    expect(props.render).toBe(trigger)
  })

  it("preserves an explicit trigger render override", () => {
    const trigger = <button type="button">Bold</button>
    const customRender = <div data-testid="custom-trigger" />

    const props = getToolbarTooltipTriggerProps(trigger, {
      render: customRender,
    })

    expect(props.render).toBe(customRender)
  })
})
