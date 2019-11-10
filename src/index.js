import * as postcss from 'postcss';
import postcssSelector from 'postcss-selector-parser';

/** PostCSS Plugin that transforms `:is` pseudo-classes.
* @param {Object} opts
*/
export default postcss.plugin('postcss-is-pseudo-class', opts => {
	opts = Object(opts);

	return onEachRoot.bind(opts);
});

/** Conditionally transform any css with rules with an `:is` pseudo-class.
* @param {Object} rule
*/
function onEachRoot(sheet) {
	// walk rules that likely contain an :is() pseudo-class
	sheet.walkRules(/:is\(.+\)/, rule => {
		const oldSelector = rule.selector;
		const newSelector = getTransformedSelectorList.call(this, oldSelector);

		if (oldSelector !== newSelector) {
			rule.selector = newSelector;
		}
	});
}

/** Return a selector list with any `:is` pseudo-classes transformed.
* @param {Object} rule
*/
function getTransformedSelectorList(selectors) {
	return postcssSelector(
		selector => selector.each(onEachSelector.bind(this))
	).processSync(selectors);
}

/** Return a selector with any `:is` pseudo-classes transformed.
* @param {Object} selector
*/
function onEachSelector(selector) {
	// conditionally transform a selector
	selector.each((part, index) => {
		if (isAcceptableContainer(part)) {
			// transform inner-selectors first
			onEachSelector.call(this, part);

			if (isAcceptableIsPseudoClass(part)) {
				// replace the `:is` pseudo-class in the clone with its inner selectors
				part.each(innerPart => {
					// clone the outer selector and the inner selector
					const selectorClone = selector.clone();
					const innerClone = innerPart.clone();

					// remove any selector list whitespace that would coincidently introduce a descendant combinator
					if (index > 0) {
						const innerPartDeepestFirst = getMostDeeplyNestedFirstNode(innerClone);

						getMostDeeplyNestedFirstNode(selectorClone).spaces.before = innerPartDeepestFirst.spaces.before;

						innerPartDeepestFirst.spaces.before = '';
					}

					// replace the `:is` pseudo-class in the clone with the inner selector
					selectorClone.nodes[index] = innerClone;

					// insert the transformed selector before the current selector
					selector.parent.insertBefore(selector, selectorClone);

					// transform any inner `:is` pseudo-classes
					onEachSelector.call(this, selectorClone);
				});

				// remove the transformed selector
				selector.remove();

				// return false to stop transforming this selector
				return false;
			}
		}
	});
}

/** Return whether a node is an acceptable container (having nested nodes)
* @param {Object} node
*/
function isAcceptableContainer(node) {
	return Array.isArray(node.nodes) && node.nodes.length;
}

/** Returns whether a node is an `:is` pseudo-class with no immediately nested complex selector.
* @param {Object} node
*/
function isAcceptableIsPseudoClass(node) {
	return isIsPseudoClass(node) && node.nodes.every(hasNoImmediatelyNestedComplexSelector);
}

/** Returns whether a node is an `:is` pseudo-class.
* @param {Object} node
*/
function isIsPseudoClass(node) {
	return node.type === 'pseudo' && node.value === ':is';
}

/** Returns whether a node has no immediately nested complex selector.
* @param {Object} node
*/
function hasNoImmediatelyNestedComplexSelector(node) {
	return !isAcceptableContainer(node) || node.nodes.every(isntCombinator)
}

/** Returns whether a node is not a combinator.
* @param {Object} node
*/
function isntCombinator(node) {
	return node.type !== 'combinator';
}

/** Return the most deeply nested first node.
* @param {Object} node
*/
function getMostDeeplyNestedFirstNode(node) {
	return Array.isArray(node.nodes) && node.nodes.length
		? getMostDeeplyNestedFirstNode(node.nodes[0])
	: node;
}
