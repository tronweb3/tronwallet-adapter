import type { PropType, CSSProperties } from 'vue';
import { defineComponent } from 'vue';
export const ButtonProps = {
    className: {
        type: String,
        default: '',
    },
    disabled: {
        type: Boolean,
        default: false,
    },
    style: {
        type: Object as PropType<CSSProperties>,
        default: () => ({}),
    },
    tabIndex: {
        type: Number,
        default: 0,
    },
    icon: {
        type: String,
        default: '',
    },
    onClick: {
        type: Function,
        required: false,
    },
};
export const Button = defineComponent({
    name: 'Button',
    props: ButtonProps,
    setup(props, { slots }) {
        function handleClick(e: MouseEvent) {
            props.onClick?.();
            const target = e.currentTarget as HTMLElement | null;
            setTimeout(() => {
                target?.blur();
            }, 300);
        }
        return () => (
            <button
                data-testid="wallet-button"
                onClick={handleClick}
                class={`adapter-vue-button ${props.className}`}
                tabindex={props.tabIndex}
                disabled={props.disabled}
                style={props.style}
            >
                {props.icon && (
                    <i class="button-icon">
                        <img src={props.icon} />
                    </i>
                )}
                {slots.default ? slots.default() : null}
            </button>
        );
    },
});
