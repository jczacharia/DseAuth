// Copyright (c) PNC Financial Services. All rights reserved.

using System.CodeDom.Compiler;
using System.Reflection;
using Vogen;

[assembly: VogenDefaults(
    toPrimitiveCasting: CastOperator.Implicit,
    staticAbstractsGeneration: StaticAbstractsGeneration.ValueObjectsDeriveFromTheInterface
        | StaticAbstractsGeneration.EqualsOperators
        | StaticAbstractsGeneration.ExplicitCastFromPrimitive
        | StaticAbstractsGeneration.ImplicitCastToPrimitive
        | StaticAbstractsGeneration.FactoryMethods,
    conversions: Conversions.SystemTextJson | Conversions.TypeConverter,
    openApiSchemaCustomizations: OpenApiSchemaCustomizations.GenerateOpenApiMappingExtensionMethod
)]

namespace Dse.Extensions;

public static class VogenStructExtensions
{
    extension<TW, TP>(IVogen<TW, TP>)
        where TW : struct, IVogen<TW, TP>
        where TP : struct
    {
        public static TW? FromNullable(TP? value) => value is null ? null : TW.From(value.Value);
    }

    extension<TW, TP>(IVogen<TW, TP>)
        where TW : struct, IVogen<TW, TP>
        where TP : class
    {
        public static TW? FromNullable(TP? value) => value is null ? null : TW.From(value);
    }
}

public static class VogenExtensions
{
    extension<TW, TP>(IVogen<TW, TP>)
        where TW : class, IVogen<TW, TP>
        where TP : struct
    {
        public static TW? FromNullable(TP? value) => value is null ? null : TW.From(value.Value);
    }

    extension<TW, TP>(IVogen<TW, TP>)
        where TW : class, IVogen<TW, TP>
        where TP : class
    {
        public static TW? FromNullable(TP? value) => value is null ? null : TW.From(value);
    }

    extension(Type targetType)
    {
        public bool IsVogenValueObject()
        {
            GeneratedCodeAttribute? generatedCode = targetType.GetCustomAttribute<GeneratedCodeAttribute>();
            return generatedCode is { Tool: "Vogen" };
        }
    }
}
