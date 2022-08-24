export type PricingTableProps = {
	/**
	 * Title of the pricing table.
	 */
	title: string;

	/**
	 * Array of items to display in the pricing table.
	 */
	items: string[];

	/**
	 * The columns to add to the table.
	 */
	children: React.ReactNode;
};

export type PricingTableColumnProps = {
	/**
	 * Items to show in a column.
	 */
	children: React.ReactElement[];
};

export type PricingTableHeaderProps = {
	/**
	 * Items to show in a header.
	 */
	children: React.ReactNode;
};

export type PricingTableItemProps = {
	/**
	 * Whether or not the item is included in the column.
	 */
	isIncluded: boolean;

	/**
	 * A custom label to display instead of the default one.
	 */
	label?: string | number | React.ReactElement;

	/**
	 * Index of the item, relative to other PricingTableItem components. Internal use only.
	 */
	index?: number;
};