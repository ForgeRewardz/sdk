import {
  type Codama,
  assertIsNode,
  bottomUpTransformerVisitor,
  isNode,
  numberTypeNode,
  structFieldTypeNode,
} from 'codama';

/**
 * Prepends discriminator and version fields to all account structs.
 *
 * REWARDZ MVP uses a 2-byte prefix: discriminator_u8 + version_u8.
 * This transform inserts those fields before the existing account fields
 * so the generated decoders read the prefix correctly.
 */
export function appendAccountDiscriminator(codama: Codama): Codama {
  codama.update(
    bottomUpTransformerVisitor([
      {
        select: '[accountNode]',
        transform: (node) => {
          assertIsNode(node, 'accountNode');

          if (isNode(node.data, 'structTypeNode')) {
            const updatedNode = {
              ...node,
              data: {
                ...node.data,
                fields: [
                  structFieldTypeNode({
                    name: 'discriminator',
                    type: numberTypeNode('u8'),
                  }),
                  structFieldTypeNode({
                    name: 'version',
                    type: numberTypeNode('u8'),
                  }),
                  ...node.data.fields,
                ],
              },
            };

            if (node.size !== undefined) {
              return {
                ...updatedNode,
                size: (node.size ?? 0) + 2,
              };
            }

            return updatedNode;
          }

          return node;
        },
      },
    ]),
  );
  return codama;
}
